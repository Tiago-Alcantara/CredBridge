import { type FactoryProvider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrivyClient } from '@privy-io/node';

export const PRIVY_CLIENT = Symbol('PRIVY_CLIENT');

export const privyClientProvider = {
  provide: PRIVY_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): PrivyClient => {
    const appId = config.get<string>('PRIVY_APP_ID');
    const appSecret = config.get<string>('PRIVY_APP_SECRET');
    const jwtVerificationKey = config.get<string>('PRIVY_JWT_VERIFICATION_KEY');

    if (!appId?.trim() || !appSecret?.trim()) {
      throw new Error('PRIVY_APP_ID and PRIVY_APP_SECRET must be configured');
    }

    return new PrivyClient({
      appId,
      appSecret,
      jwtVerificationKey: jwtVerificationKey?.trim() || undefined,
    });
  },
} satisfies FactoryProvider<PrivyClient>;
