import { ConflictException } from '@nestjs/common';
import {
  Account,
  Asset,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { StellarService } from './stellar.service';
import type { PrismaService } from '../prisma/prisma.service';

const POOL_CONTRACT_ID =
  'CDIMUPT2SBPGBR5DHFVQ3HK74DHL4TMVCQIXINJYV2SRHXRYUYQRBVC7';
const BRLT_CONTRACT_ID =
  'CBEZ5KHMHKXMVXL4UZGCFV2ZKDNB5YPFR7TZGX34D3QRBMFG25QQSQH';

describe('StellarService', () => {
  const originalEnv = { ...process.env };
  const userFindUnique = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = {
      ...originalEnv,
      STELLAR_RPC_URL: 'http://localhost:8000/soroban/rpc',
      STELLAR_NFE_CONTRACT_ID:
        'CDIMUPT2SBPGBR5DHFVQ3HK74DHL4TMVCQIXINJYV2SRHXRYUYQRBVC7',
      STELLAR_SECRET_KEY: Keypair.random().secret(),
      STELLAR_POOL_CONTRACT_ID: POOL_CONTRACT_ID,
      STELLAR_BRLT_TOKEN_ID: BRLT_CONTRACT_ID,
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function createService() {
    return new StellarService({
      user: {
        findUnique: userFindUnique,
      },
    } as unknown as PrismaService);
  }

  it('rejects tokenization with a conflict when the PME has no Stellar wallet', async () => {
    userFindUnique.mockResolvedValue({ stellarWalletId: null });
    const service = createService();

    await expect(
      service.tokenizeNfe({
        key: 'receivable-1',
        value: 1000,
        dueDate: new Date('2026-06-20T00:00:00.000Z'),
        xmlHash: null,
        ownerUserId: 'pme-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('tops up an existing testnet account to five XLM when the balance is below one and a half XLM', async () => {
    const service = createService();
    const destination = Keypair.random().publicKey();
    const platformAddress = (service as any).platformKeypair.publicKey();
    const submitWithDetail = jest
      .spyOn(service as any, 'submitWithDetail')
      .mockResolvedValue({ hash: 'top-up-tx' });
    const destinationAccount = {
      balances: [{ asset_type: 'native', balance: '1.0' }],
    };
    const platformAccount = new Account(platformAddress, '1');

    (service as any).horizon = {
      loadAccount: jest
        .fn()
        .mockResolvedValueOnce(destinationAccount)
        .mockResolvedValueOnce(platformAccount),
    };

    const txHash = await service.fundAccountFromPlatform(destination, '1.0');

    expect(txHash).toBe('top-up-tx');
    expect(submitWithDetail).toHaveBeenCalledTimes(1);

    const transaction = submitWithDetail.mock.calls[0][0];
    const paymentOperation = transaction.operations[0];
    expect(paymentOperation.type).toBe('payment');
    expect(paymentOperation.destination).toBe(destination);
    expect(Number(paymentOperation.amount)).toBeCloseTo(0.5);
  });

  it('returns a conflict when assignment preparation cannot find the NF-e on-chain', async () => {
    const service = createService();
    const pmeKeypair = Keypair.random();

    (service as any).horizon = {
      loadAccount: jest
        .fn()
        .mockResolvedValue(new Account(pmeKeypair.publicKey(), '1')),
    };
    (service as any).server = {
      simulateTransaction: jest.fn().mockResolvedValue({
        error: 'HostError: Error(Contract, #2)',
      }),
    };

    await expect(
      service.prepareAssignment('receivable-1', pmeKeypair.publicKey()),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  describe('buildApproveTx', () => {
    it('returns an UnsignedSorobanTx with the correct shape when env contract IDs are set', async () => {
      const service = createService();
      const investorKeypair = Keypair.random();
      const investorAddress = investorKeypair.publicKey();

      const expectedResult = {
        xdr: 'mock-xdr-string',
        hashToSign: 'a'.repeat(64),
        signerPublicKey: investorAddress,
      };

      // Spy on the private helper so we don't need to mock the full Soroban simulation chain
      const buildAndAssembleSpy = jest
        .spyOn(service as any, 'buildAndAssemble')
        .mockResolvedValue(expectedResult);

      // Stub horizon.ledgers() for the approve liveUntilLedger fetch
      (service as any).horizon = {
        ledgers: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              call: jest
                .fn()
                .mockResolvedValue({ records: [{ sequence: 3000000 }] }),
            }),
          }),
        }),
      };

      const result = await service.buildApproveTx(investorAddress, 100);

      expect(result.signerPublicKey).toBe(investorAddress);
      expect(result.xdr).toBe(expectedResult.xdr);
      expect(result.hashToSign).toMatch(/^[0-9a-f]{64}$/);

      expect(buildAndAssembleSpy).toHaveBeenCalledWith(
        investorAddress,
        BRLT_CONTRACT_ID,
        'approve',
        expect.any(Array),
      );
      expect(buildAndAssembleSpy.mock.calls[0][3]).toHaveLength(4);
    });

    it('throws when contract env vars are missing', async () => {
      delete process.env.STELLAR_POOL_CONTRACT_ID;
      const service = createService();

      await expect(
        service.buildApproveTx(Keypair.random().publicKey(), 100),
      ).rejects.toThrow(
        'STELLAR_POOL_CONTRACT_ID / STELLAR_BRLT_TOKEN_ID not configured',
      );
    });
  });

  describe('buildDepositTx', () => {
    it('returns an UnsignedSorobanTx with the correct shape when env contract ID is set', async () => {
      const service = createService();
      const investorKeypair = Keypair.random();
      const investorAddress = investorKeypair.publicKey();

      const expectedResult = {
        xdr: 'mock-deposit-xdr',
        hashToSign: 'b'.repeat(64),
        signerPublicKey: investorAddress,
      };

      const buildAndAssembleSpy = jest
        .spyOn(service as any, 'buildAndAssemble')
        .mockResolvedValue(expectedResult);

      const result = await service.buildDepositTx(investorAddress, 250);

      expect(result.signerPublicKey).toBe(investorAddress);
      expect(result.xdr).toBe(expectedResult.xdr);
      expect(result.hashToSign).toMatch(/^[0-9a-f]{64}$/);

      expect(buildAndAssembleSpy).toHaveBeenCalledWith(
        investorAddress,
        POOL_CONTRACT_ID,
        'deposit',
        expect.any(Array),
      );
      expect(buildAndAssembleSpy.mock.calls[0][3]).toHaveLength(2);
    });

    it('throws when STELLAR_POOL_CONTRACT_ID is missing', async () => {
      delete process.env.STELLAR_POOL_CONTRACT_ID;
      const service = createService();

      await expect(
        service.buildDepositTx(Keypair.random().publicKey(), 250),
      ).rejects.toThrow('STELLAR_POOL_CONTRACT_ID not configured');
    });
  });

  describe('submitSignedTx', () => {
    /**
     * Builds a minimal (non-Soroban) payment transaction signed by a throwaway keypair
     * so that keypair.verify() will pass with the real ED25519 signature.
     */
    function buildSignedMinimalTx(signerKeypair: Keypair): {
      xdr: string;
      signatureHex: string;
    } {
      const account = new Account(signerKeypair.publicKey(), '0');
      const tx = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: Keypair.random().publicKey(),
            asset: Asset.native(),
            amount: '1',
          }),
        )
        .setTimeout(30)
        .build();

      const txHash = tx.hash();
      const signatureBytes = signerKeypair.sign(txHash);

      return {
        xdr: tx.toXDR(),
        signatureHex: Buffer.from(signatureBytes).toString('hex'),
      };
    }

    it('submits the transaction and returns the confirmed tx hash when the signature is valid', async () => {
      const service = createService();
      const signerKeypair = Keypair.random();
      const { xdr: txXdr, signatureHex } = buildSignedMinimalTx(signerKeypair);
      const expectedHash = 'confirmed-tx-hash-abc123';

      (service as any).server = {
        sendTransaction: jest
          .fn()
          .mockResolvedValue({ status: 'PENDING', hash: expectedHash }),
        getTransaction: jest
          .fn()
          .mockResolvedValue({ status: 'SUCCESS' }),
      };

      const result = await service.submitSignedTx({
        xdr: txXdr,
        signerPublicKey: signerKeypair.publicKey(),
        signatureHex,
      });

      expect(result).toBe(expectedHash);
      expect((service as any).server.sendTransaction).toHaveBeenCalledTimes(1);
      expect((service as any).server.getTransaction).toHaveBeenCalledWith(
        expectedHash,
      );
    });

    it('throws when the signature does not match the transaction hash', async () => {
      const service = createService();
      const signerKeypair = Keypair.random();
      const { xdr: txXdr } = buildSignedMinimalTx(signerKeypair);

      // Use a random 64-byte buffer as a deliberately wrong signature
      const wrongSignatureHex = Buffer.alloc(64, 0x42).toString('hex');

      (service as any).server = {
        sendTransaction: jest.fn(),
        getTransaction: jest.fn(),
      };

      await expect(
        service.submitSignedTx({
          xdr: txXdr,
          signerPublicKey: signerKeypair.publicKey(),
          signatureHex: wrongSignatureHex,
        }),
      ).rejects.toThrow('Signature does not match transaction hash');

      // sendTransaction should never be called for an invalid signature
      expect((service as any).server.sendTransaction).not.toHaveBeenCalled();
    });
  });
});
