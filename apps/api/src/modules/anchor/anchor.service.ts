import {
  Injectable,
  Logger,
  OnModuleInit,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { EtherfuseClient, AnchorError } from '@credbridge/anchor-client';
import type {
  Quote,
  OnRampTransaction,
  OffRampTransaction,
} from '@credbridge/anchor-client';

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
    const baseUrl = this.config.get<string>(
      'ETHERFUSE_BASE_URL',
      'https://api.sand.etherfuse.com',
    );

    if (!apiKey) {
      this.logger.warn(
        'ETHERFUSE_API_KEY not set — anchor endpoints will fail at runtime',
      );
    }

    this.client = new EtherfuseClient({ apiKey: apiKey ?? '', baseUrl });
  }

  async getOnrampQuote(userId: string, amount: number): Promise<Quote> {
    const stellarAddress = await this.requireStellarWallet(userId);
    return this.client
      .getQuote({
        fromCurrency: 'BRL',
        toCurrency: 'TESOURO',
        fromAmount: amount.toFixed(2),
        stellarAddress,
      })
      .catch((e) => this.rethrowAnchorError(e));
  }

  async getOfframpQuote(userId: string, amount: number): Promise<Quote> {
    const stellarAddress = await this.requireStellarWallet(userId);
    return this.client
      .getQuote({
        fromCurrency: 'TESOURO',
        toCurrency: 'BRL',
        fromAmount: amount.toFixed(7),
        stellarAddress,
      })
      .catch((e) => this.rethrowAnchorError(e));
  }

  async getOnboardingStatus(
    userId: string,
  ): Promise<{ onboarded: boolean; kycUrl: string }> {
    const stellarAddress = await this.requireStellarWallet(userId);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });
    const customer = await this.ensureCustomer(
      userId,
      user.email,
      stellarAddress,
      'BR',
    );

    const bankAccountId = await this.ensureBankAccountId(userId, customer.id);

    const [kycStatus, accounts] = await Promise.all([
      this.client
        .getKycStatus(customer.id, stellarAddress)
        .catch(() => 'not_started' as const),
      this.client.getFiatAccounts(customer.id),
    ]);

    if (kycStatus === 'approved') {
      this.logger.log('[Etherfuse] KYC already approved');
    }

    // If accounts were found but not yet cached, persist them
    if (accounts.length > 0 && accounts[0].id !== bankAccountId) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { etherfuseBankAccountId: accounts[0].id },
      });
    }

    const onboarded = accounts.length > 0;
    const kycUrl = await this.client.getKycUrl(
      customer.id,
      stellarAddress,
      bankAccountId,
    );
    return { onboarded, kycUrl };
  }

  async startOnramp(
    userId: string,
    amount: number,
    quoteId?: string,
  ): Promise<OnRampTransaction> {
    try {
      const stellarAddress = await this.requireStellarWallet(userId);
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { email: true },
      });

      const customer = await this.ensureCustomer(
        userId,
        user.email,
        stellarAddress,
        'BR',
      );
      if (!customer?.id) {
        throw new BadRequestException('Failed to get Etherfuse customer ID');
      }

      const bankAccountId = await this.ensureBankAccountId(userId, customer.id);

      const accounts = await this.client.getFiatAccounts(customer.id);
      if (accounts.length === 0) {
        throw new BadRequestException(
          'KYC_INCOMPLETE: complete onboarding before depositing',
        );
      }

      // T&C acceptance is a separate API step from the hosted KYC iframe.
      // Etherfuse requires this before the first order; safe to call repeatedly.
      const presignedUrl = await this.client.getKycUrl(
        customer.id,
        stellarAddress,
        bankAccountId,
      );
      try {
        await this.client.acceptAgreements(presignedUrl);
        this.logger.log('[Etherfuse] Agreements accepted');
      } catch (e) {
        const anchorErr =
          e instanceof AnchorError ? ` (HTTP ${e.statusCode})` : '';
        this.logger.error(
          `[Etherfuse] acceptAgreements failed${anchorErr}: ${(e as Error).message}`,
        );
      }

      const quote =
        quoteId && quoteId.trim()
          ? { id: quoteId.trim() }
          : await this.client.getQuote({
              customerId: customer.id,
              fromCurrency: 'BRL',
              toCurrency: 'TESOURO',
              fromAmount: amount.toFixed(2),
              stellarAddress,
            });

      this.logger.log('[Etherfuse] Creating onramp order');
      return await this.client.createOnRamp({
        customerId: customer.id,
        quoteId: quote.id,
        stellarAddress,
        fromCurrency: 'BRL',
        toCurrency: 'TESOURO',
        amount: amount.toFixed(2),
        bankAccountId,
      });
    } catch (e) {
      this.rethrowAnchorError(e);
    }
  }

  async startOfframp(
    userId: string,
    amount: number,
    quoteId?: string,
  ): Promise<OffRampTransaction> {
    try {
      const stellarAddress = await this.requireStellarWallet(userId);
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { email: true },
      });

      const customer = await this.ensureCustomer(
        userId,
        user.email,
        stellarAddress,
        'BR',
      );
      if (!customer?.id) {
        throw new BadRequestException('Failed to get Etherfuse customer ID');
      }

      const bankAccountId = await this.ensureBankAccountId(userId, customer.id);

      const accounts = await this.client.getFiatAccounts(customer.id);
      if (accounts.length === 0) {
        throw new BadRequestException(
          'KYC_INCOMPLETE: complete onboarding before withdrawing',
        );
      }

      const presignedUrl = await this.client.getKycUrl(
        customer.id,
        stellarAddress,
        bankAccountId,
      );
      try {
        await this.client.acceptAgreements(presignedUrl);
        this.logger.log('[Etherfuse] Agreements accepted');
      } catch (e) {
        const anchorErr =
          e instanceof AnchorError ? ` (HTTP ${e.statusCode})` : '';
        this.logger.error(
          `[Etherfuse] acceptAgreements failed${anchorErr}: ${(e as Error).message}`,
        );
      }

      const quote =
        quoteId && quoteId.trim()
          ? { id: quoteId.trim() }
          : await this.client.getQuote({
              customerId: customer.id,
              fromCurrency: 'TESOURO',
              toCurrency: 'BRL',
              fromAmount: amount.toFixed(7),
              stellarAddress,
            });

      this.logger.log('[Etherfuse] Creating offramp order');
      return await this.client.createOffRamp({
        customerId: customer.id,
        quoteId: quote.id,
        stellarAddress,
        fromCurrency: 'TESOURO',
        toCurrency: 'BRL',
        amount: amount.toFixed(7),
        fiatAccountId: accounts[0].id,
      });
    } catch (e) {
      this.rethrowAnchorError(e);
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async ensureCustomer(
    userId: string,
    email: string,
    stellarAddress: string,
    country: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (user?.etherfuseCustomerId) {
      const existing = await this.client.getCustomer({
        customerId: user.etherfuseCustomerId,
      });
      if (existing) {
        this.logger.log(`[Etherfuse] Reusing customer: ${existing.id}`);
        return existing;
      }
      // Stale ID — customer no longer exists at Etherfuse; clear it and recreate
      this.logger.warn(
        `[Etherfuse] Stale customerId ${user.etherfuseCustomerId} — clearing and recreating`,
      );
      await this.prisma.user.update({
        where: { id: userId },
        data: { etherfuseCustomerId: null, etherfuseBankAccountId: null },
      });
    }

    const customer = await this.client.createCustomer({
      email,
      country,
      publicKey: stellarAddress,
    });

    if (!customer?.id) {
      throw new BadRequestException(
        'Failed to create or retrieve Etherfuse customer',
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { etherfuseCustomerId: customer.id },
    });

    this.logger.log(`[Etherfuse] Customer created/recovered: ${customer.id}`);
    return customer;
  }

  /**
   * Returns a stable bank account ID for this user, persisting it in the DB.
   * Priority: DB cache → existing Etherfuse accounts → new UUID slot.
   * Passing the same ID to every getKycUrl call prevents "Only one BRL bank
   * account is allowed" errors caused by generating a new UUID each time.
   */
  private async ensureBankAccountId(
    userId: string,
    customerId: string,
  ): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { etherfuseBankAccountId: true },
    });

    if (user?.etherfuseBankAccountId) {
      this.logger.log(
        `[Etherfuse] Reusing bank account: ${user.etherfuseBankAccountId}`,
      );
      return user.etherfuseBankAccountId;
    }

    const accounts = await this.client.getFiatAccounts(customerId);
    if (accounts.length > 0) {
      const bankAccountId = accounts[0].id;
      this.logger.log(
        `[Etherfuse] Discovered existing bank account: ${bankAccountId}`,
      );
      await this.prisma.user.update({
        where: { id: userId },
        data: { etherfuseBankAccountId: bankAccountId },
      });
      return bankAccountId;
    }

    // No account yet — generate the ID that will be registered during hosted KYC
    const bankAccountId = crypto.randomUUID().replace(/-/g, '');
    this.logger.log(
      `[Etherfuse] Generated new bank account slot: ${bankAccountId}`,
    );
    await this.prisma.user.update({
      where: { id: userId },
      data: { etherfuseBankAccountId: bankAccountId },
    });
    return bankAccountId;
  }

  private rethrowAnchorError(err: unknown): never {
    if (err instanceof AnchorError) {
      const msg = `Etherfuse: ${err.message}`;
      if (err.statusCode >= 400 && err.statusCode < 500) {
        throw new BadRequestException(msg);
      }
      throw new UnprocessableEntityException(msg);
    }
    throw err;
  }

  private async requireStellarWallet(userId: string): Promise<string> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { stellarWalletId: true, privyStellarWalletAddress: true },
    });
    const walletAddress =
      user.privyStellarWalletAddress ?? user.stellarWalletId ?? null;
    if (!walletAddress) {
      throw new Error(
        `User ${userId} has no Stellar wallet — cannot use anchor`,
      );
    }
    return walletAddress;
  }
}
