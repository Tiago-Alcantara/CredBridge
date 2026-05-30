import { ConflictException } from '@nestjs/common';
import { Account, Keypair } from '@stellar/stellar-sdk';
import { StellarService } from './stellar.service';
import type { PrismaService } from '../prisma/prisma.service';

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
});
