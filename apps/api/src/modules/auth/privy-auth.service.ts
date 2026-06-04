import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { LinkedAccount, PrivyClient } from '@privy-io/node';
import { PRIVY_CLIENT } from './privy-client.provider';

export interface VerifiedPrivySession {
  privyUserId: string;
  email: string;
  stellarWalletAddress: string;
}

@Injectable()
export class PrivyAuthService {
  constructor(
    @Inject(PRIVY_CLIENT) private readonly privyClient: PrivyClient,
  ) {}

  async verifySession(
    accessToken: string,
    identityToken: string,
  ): Promise<VerifiedPrivySession> {
    if (!accessToken.trim() || !identityToken.trim()) {
      throw new UnauthorizedException(
        'Privy access and identity tokens are required',
      );
    }

    try {
      const authUtils = this.privyClient.utils().auth();
      const claims = await authUtils.verifyAccessToken(accessToken);
      const identityUser = await authUtils.verifyIdentityToken(identityToken);

      if (
        !claims.user_id ||
        !identityUser.id ||
        claims.user_id !== identityUser.id
      ) {
        throw new UnauthorizedException(
          'Privy tokens belong to different users',
        );
      }

      const user = await this.privyClient.users()._get(claims.user_id);
      const email = this.findEmailAddress(user.linked_accounts);
      if (!email) {
        throw new UnauthorizedException(
          'Privy account must have a verified email address',
        );
      }

      const stellarWalletAddress = this.findStellarWalletAddress(
        user.linked_accounts,
      );
      if (!stellarWalletAddress) {
        throw new UnauthorizedException(
          'Privy Stellar embedded wallet must be created before session exchange',
        );
      }

      return {
        privyUserId: claims.user_id,
        email,
        stellarWalletAddress,
      };
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid Privy session');
    }
  }

  private findEmailAddress(linkedAccounts: LinkedAccount[]): string | null {
    for (const account of linkedAccounts) {
      if (account.type === 'email' && account.address.trim()) {
        return account.address.trim().toLowerCase();
      }

      if (account.type === 'google_oauth' && account.email.trim()) {
        return account.email.trim().toLowerCase();
      }
    }

    return null;
  }

  private findStellarWalletAddress(
    linkedAccounts: LinkedAccount[],
  ): string | null {
    for (const account of linkedAccounts) {
      if (
        account.type === 'wallet' &&
        account.chain_type === 'stellar' &&
        account.wallet_client_type === 'privy' &&
        account.address.trim()
      ) {
        return account.address.trim();
      }
    }

    return null;
  }
}
