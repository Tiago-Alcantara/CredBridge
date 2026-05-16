import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { EtherfuseClient } from '@credbridge/anchor-client';
import type { Quote, OnRampTransaction, OffRampTransaction } from '@credbridge/anchor-client';

const TESOURO_ISSUER = 'GC3CW7EDYRTWQ635VDIGY6S4ZUF5L6TQ7AA4MWS7LEQDBLUSZXV7UPS4';

@Injectable()
export class AnchorService implements OnModuleInit {
  private readonly logger = new Logger(AnchorService.name);
  private client!: EtherfuseClient;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const apiKey = this.config.get<string>('ETHERFUSE_API_KEY');
    const baseUrl = this.config.get<string>('ETHERFUSE_BASE_URL', 'https://api.etherfuse.com');

    if (!apiKey) {
      this.logger.warn('ETHERFUSE_API_KEY not set — anchor endpoints will fail at runtime');
    }

    this.client = new EtherfuseClient({ apiKey: apiKey ?? '', baseUrl });
  }

  async getOnrampQuote(userId: string, amount: number): Promise<Quote> {
    const stellarAddress = await this.requireStellarWallet(userId);
    return this.client.getQuote({
      fromCurrency: 'BRL',
      toCurrency: 'TESOURO',
      fromAmount: amount.toFixed(2),
      stellarAddress,
    });
  }

  async getOfframpQuote(userId: string, amount: number): Promise<Quote> {
    const stellarAddress = await this.requireStellarWallet(userId);
    return this.client.getQuote({
      fromCurrency: 'TESOURO',
      toCurrency: 'BRL',
      fromAmount: amount.toFixed(7),
      stellarAddress,
    });
  }

  async startOnramp(userId: string, amount: number, quoteId?: string): Promise<OnRampTransaction> {
    const stellarAddress = await this.requireStellarWallet(userId);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });

    const customer = await this.ensureCustomer(userId, user.email, stellarAddress, 'BR');

    const quote = quoteId
      ? { id: quoteId }
      : await this.client.getQuote({
          fromCurrency: 'BRL',
          toCurrency: 'TESOURO',
          fromAmount: amount.toFixed(2),
          stellarAddress,
        });

    return this.client.createOnRamp({
      customerId: customer.id,
      quoteId: quote.id,
      stellarAddress,
      fromCurrency: 'BRL',
      toCurrency: 'TESOURO',
      amount: amount.toFixed(2),
    });
  }

  async startOfframp(userId: string, amount: number, quoteId?: string): Promise<OffRampTransaction> {
    const stellarAddress = await this.requireStellarWallet(userId);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });

    const customer = await this.ensureCustomer(userId, user.email, stellarAddress, 'BR');
    const accounts = await this.client.getFiatAccounts(customer.id);
    if (accounts.length === 0) {
      throw new Error('No PIX account registered — complete KYC first');
    }

    const quote = quoteId
      ? { id: quoteId }
      : await this.client.getQuote({
          fromCurrency: 'TESOURO',
          toCurrency: 'BRL',
          fromAmount: amount.toFixed(7),
          stellarAddress,
        });

    return this.client.createOffRamp({
      customerId: customer.id,
      quoteId: quote.id,
      stellarAddress,
      fromCurrency: 'TESOURO',
      toCurrency: 'BRL',
      amount: amount.toFixed(7),
      fiatAccountId: accounts[0].id,
    });
  }

  async getKycUrl(userId: string): Promise<string> {
    const stellarAddress = await this.requireStellarWallet(userId);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
    const customer = await this.ensureCustomer(userId, user.email, stellarAddress, 'BR');

    if (!this.client.getKycUrl) throw new Error('KYC URL not supported');
    return this.client.getKycUrl(customer.id, stellarAddress);
  }

  private async ensureCustomer(userId: string, email: string, stellarAddress: string, country: string) {
    const existing = await this.client.getCustomer({ email, country }).catch(() => null);
    if (existing) return existing;

    return this.client.createCustomer({ email, country, publicKey: stellarAddress });
  }

  private async requireStellarWallet(userId: string): Promise<string> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { stellarWalletId: true },
    });
    if (!user.stellarWalletId) {
      throw new Error(`User ${userId} has no Stellar wallet — cannot use anchor`);
    }
    return user.stellarWalletId;
  }
}
