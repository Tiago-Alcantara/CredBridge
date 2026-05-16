import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AnchorService } from './anchor.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { Quote, Customer, OnRampTransaction, OffRampTransaction } from '@credbridge/anchor-client';

// -- mock functions defined before jest.mock (hoisted by Jest) --
const mockGetQuote = jest.fn();
const mockGetCustomer = jest.fn();
const mockCreateCustomer = jest.fn();
const mockGetFiatAccounts = jest.fn();
const mockCreateOnRamp = jest.fn();
const mockCreateOffRamp = jest.fn();
const mockGetKycUrl = jest.fn();

jest.mock('@credbridge/anchor-client', () => ({
  EtherfuseClient: jest.fn().mockImplementation(() => ({
    getQuote: mockGetQuote,
    getCustomer: mockGetCustomer,
    createCustomer: mockCreateCustomer,
    getFiatAccounts: mockGetFiatAccounts,
    createOnRamp: mockCreateOnRamp,
    createOffRamp: mockCreateOffRamp,
    getKycUrl: mockGetKycUrl,
    name: 'etherfuse',
    displayName: 'Etherfuse',
    supportedCurrencies: ['BRL', 'MXN'],
    supportedRails: ['pix', 'spei'],
    supportedTokens: [{ symbol: 'TESOURO', name: 'Tesouro', description: 'BRL-backed' }],
    capabilities: { sep24: true },
  })),
}));

const userId = 'user-1';
const stellarWallet = 'GABC1234567890';

function baseUser(overrides = {}) {
  return { id: userId, email: 'pme@test.com', stellarWalletId: stellarWallet, ...overrides };
}

function baseQuote(overrides = {}): Quote {
  return {
    id: 'q-1',
    fromCurrency: 'BRL',
    toCurrency: 'TESOURO',
    fromAmount: '100.00',
    toAmount: '100.0000000',
    exchangeRate: '1.0',
    fee: '0.50',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function baseCustomer(overrides = {}): Customer {
  return {
    id: 'cust-1',
    email: 'pme@test.com',
    kycStatus: 'approved',
    country: 'BR',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const baseFiatAccount = {
  id: 'acct-1',
  type: 'pix',
  accountNumber: '11111111111',
  bankName: 'Nubank',
  accountHolderName: 'PME',
  createdAt: '',
};

describe('AnchorService', () => {
  let service: AnchorService;
  let userFindOrThrow: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();

    userFindOrThrow = jest.fn().mockResolvedValue(baseUser());

    const prismaMock = {
      user: {
        findUniqueOrThrow: userFindOrThrow,
        findUnique: jest.fn().mockResolvedValue(baseUser()),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnchorService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string, def?: string) => def ?? '') },
        },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    await module.init(); // triggers onModuleInit

    service = module.get(AnchorService);

    // Default mock implementations
    mockGetQuote.mockResolvedValue(baseQuote());
    mockGetCustomer.mockResolvedValue(null);
    mockCreateCustomer.mockResolvedValue(baseCustomer());
    mockGetFiatAccounts.mockResolvedValue([baseFiatAccount]);
    mockCreateOnRamp.mockResolvedValue({ id: 'onramp-1', interactiveUrl: 'https://etherfuse.com/onramp/1', status: 'pending' } as unknown as OnRampTransaction);
    mockCreateOffRamp.mockResolvedValue({ id: 'offramp-1', interactiveUrl: 'https://etherfuse.com/offramp/1', status: 'pending' } as unknown as OffRampTransaction);
    mockGetKycUrl.mockResolvedValue('https://etherfuse.com/kyc/1');
  });

  describe('getOnrampQuote', () => {
    it('returns BRL → TESOURO quote', async () => {
      const quote = await service.getOnrampQuote(userId, 100);
      expect(quote.fromCurrency).toBe('BRL');
      expect(mockGetQuote).toHaveBeenCalledWith(
        expect.objectContaining({ fromCurrency: 'BRL', toCurrency: 'TESOURO', fromAmount: '100.00' }),
      );
    });

    it('throws if user has no Stellar wallet', async () => {
      userFindOrThrow.mockResolvedValue(baseUser({ stellarWalletId: null }));
      await expect(service.getOnrampQuote(userId, 100)).rejects.toThrow('no Stellar wallet');
    });
  });

  describe('getOfframpQuote', () => {
    it('returns TESOURO → BRL quote', async () => {
      mockGetQuote.mockResolvedValue(baseQuote({ fromCurrency: 'TESOURO', toCurrency: 'BRL' }));
      const quote = await service.getOfframpQuote(userId, 100);
      expect(mockGetQuote).toHaveBeenCalledWith(
        expect.objectContaining({ fromCurrency: 'TESOURO', toCurrency: 'BRL' }),
      );
      expect(quote.fromCurrency).toBe('TESOURO');
    });
  });

  describe('startOnramp', () => {
    it('creates customer when none exists, returns OnRampTransaction', async () => {
      const tx = await service.startOnramp(userId, 100);
      expect(mockCreateCustomer).toHaveBeenCalled();
      expect(mockCreateOnRamp).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: 'cust-1', fromCurrency: 'BRL', toCurrency: 'TESOURO' }),
      );
      expect((tx as unknown as { interactiveUrl: string }).interactiveUrl).toContain('etherfuse.com');
    });

    it('reuses existing customer without creating a new one', async () => {
      mockGetCustomer.mockResolvedValue(baseCustomer());
      await service.startOnramp(userId, 100);
      expect(mockCreateCustomer).not.toHaveBeenCalled();
    });

    it('skips quote fetch when quoteId is provided', async () => {
      await service.startOnramp(userId, 100, 'existing-q-id');
      expect(mockGetQuote).not.toHaveBeenCalled();
      expect(mockCreateOnRamp).toHaveBeenCalledWith(
        expect.objectContaining({ quoteId: 'existing-q-id' }),
      );
    });
  });

  describe('startOfframp', () => {
    it('creates OffRampTransaction using first PIX account', async () => {
      const tx = await service.startOfframp(userId, 50);
      expect(mockCreateOffRamp).toHaveBeenCalledWith(
        expect.objectContaining({ fiatAccountId: 'acct-1', fromCurrency: 'TESOURO', toCurrency: 'BRL' }),
      );
      expect((tx as unknown as { interactiveUrl: string }).interactiveUrl).toContain('etherfuse.com');
    });

    it('throws if user has no registered PIX account', async () => {
      mockGetFiatAccounts.mockResolvedValue([]);
      await expect(service.startOfframp(userId, 50)).rejects.toThrow('No PIX account registered');
    });
  });

  describe('getKycUrl', () => {
    it('returns Etherfuse KYC URL', async () => {
      const url = await service.getKycUrl(userId);
      expect(url).toContain('etherfuse.com/kyc');
    });
  });
});
