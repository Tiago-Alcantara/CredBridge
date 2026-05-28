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

  it('uses the legacy STELLAR_CONTRACT_ID when the NF-e contract variable is absent', () => {
    const legacyContractId =
      'CDIMUPT2SBPGBR5DHFVQ3HK74DHL4TMVCQIXINJYV2SRHXRYUYQRBVC7';
    delete process.env.STELLAR_NFE_CONTRACT_ID;
    process.env.STELLAR_CONTRACT_ID = legacyContractId;

    const service = createService();

    expect(
      (service as unknown as { contractId: string | undefined }).contractId,
    ).toBe(legacyContractId);
  });

  describe('ensureAccountHasMinimumXlm', () => {
    it('creates the account when Soroban contract configuration is missing', async () => {
      delete process.env.STELLAR_NFE_CONTRACT_ID;
      const service = createService();
      const destination = Keypair.random().publicKey();
      const platformAddress = Keypair.fromSecret(
        process.env.STELLAR_SECRET_KEY!,
      ).publicKey();
      const submitWithDetail = jest
        .spyOn(
          service as unknown as {
            submitWithDetail: () => Promise<{ hash: string }>;
          },
          'submitWithDetail',
        )
        .mockResolvedValue({ hash: 'create-account-tx' });
      (service as unknown as { horizon: { loadAccount: jest.Mock } }).horizon =
        {
          loadAccount: jest.fn().mockImplementation((accountId: string) => {
            if (accountId === destination) {
              return Promise.reject(new Error('not found'));
            }

            if (accountId === platformAddress) {
              return Promise.resolve(new Account(platformAddress, '1'));
            }

            return Promise.reject(new Error(`Unexpected account ${accountId}`));
          }),
        };

      const result = await service.ensureAccountHasMinimumXlm(
        destination,
        '5.0',
      );

      expect(result).toBe('create-account-tx');
      expect(submitWithDetail).toHaveBeenCalledWith(
        expect.anything(),
        'fundAccountFromPlatform',
      );
    });

    it('creates the account with the minimum balance when the wallet does not exist', async () => {
      const service = createService();
      const fundAccountFromPlatform = jest
        .spyOn(service, 'fundAccountFromPlatform')
        .mockResolvedValue('create-account-tx');
      (service as unknown as { horizon: { loadAccount: jest.Mock } }).horizon =
        {
          loadAccount: jest.fn().mockRejectedValue(new Error('not found')),
        };

      const result = await service.ensureAccountHasMinimumXlm(
        Keypair.random().publicKey(),
        '5.0',
      );

      expect(result).toBe('create-account-tx');
      expect(fundAccountFromPlatform).toHaveBeenCalledWith(
        expect.any(String),
        '5.0',
      );
    });

    it('does nothing when the account already has at least the minimum native balance', async () => {
      const service = createService();
      const fundAccountFromPlatform = jest.spyOn(
        service,
        'fundAccountFromPlatform',
      );
      (service as unknown as { horizon: { loadAccount: jest.Mock } }).horizon =
        {
          loadAccount: jest.fn().mockResolvedValue({
            balances: [
              {
                asset_type: 'native',
                balance: '5.0000000',
              },
            ],
          }),
        };

      const result = await service.ensureAccountHasMinimumXlm(
        Keypair.random().publicKey(),
        '5.0',
      );

      expect(result).toBeNull();
      expect(fundAccountFromPlatform).not.toHaveBeenCalled();
    });

    it('tops up the account when the native balance is below the minimum', async () => {
      const service = createService();
      const destination = Keypair.random().publicKey();
      const platformKeypair = (
        service as unknown as { platformKeypair: Keypair }
      ).platformKeypair;
      const submitWithDetail = jest
        .spyOn(
          service as unknown as {
            submitWithDetail: () => Promise<{ hash: string }>;
          },
          'submitWithDetail',
        )
        .mockResolvedValue({ hash: 'top-up-tx' });
      (service as unknown as { horizon: { loadAccount: jest.Mock } }).horizon =
        {
          loadAccount: jest.fn().mockImplementation((accountId: string) => {
            if (accountId === destination) {
              return Promise.resolve({
                balances: [
                  {
                    asset_type: 'native',
                    balance: '2.0000000',
                  },
                ],
              });
            }

            return Promise.resolve(
              new Account(platformKeypair.publicKey(), '1'),
            );
          }),
        };

      const result = await service.ensureAccountHasMinimumXlm(destination, '5.0');

      expect(result).toBe('top-up-tx');
      expect(submitWithDetail).toHaveBeenCalledWith(
        expect.anything(),
        'ensureAccountHasMinimumXlm',
      );
    });
  });
});
