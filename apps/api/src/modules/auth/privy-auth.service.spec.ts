import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import type { User, VerifyAccessTokenResponse } from '@privy-io/node';
import { PRIVY_CLIENT, privyClientProvider } from './privy-client.provider';
import { PrivyAuthService } from './privy-auth.service';

jest.mock('@privy-io/node', () => ({
  PrivyClient: jest.fn(),
}));

const privyUserId = 'did:privy:user-1';
const validClaims: VerifyAccessTokenResponse = {
  app_id: 'app-id',
  issuer: 'privy.io',
  issued_at: 1,
  expiration: 2,
  session_id: 'session-id',
  user_id: privyUserId,
};
const emailAccount: User['linked_accounts'][number] = {
  type: 'email',
  address: 'Owner@Empresa.COM',
  first_verified_at: 1,
  latest_verified_at: 1,
  verified_at: 1,
};
const stellarEmbeddedWallet: User['linked_accounts'][number] = {
  type: 'wallet',
  id: 'wallet-id',
  address: 'GPRIVYWALLET',
  chain_id: 'stellar:testnet',
  chain_type: 'stellar',
  connector_type: 'embedded',
  delegated: false,
  first_verified_at: 1,
  imported: false,
  latest_verified_at: 1,
  public_key: 'public-key',
  recovery_method: 'privy',
  verified_at: 1,
  wallet_client: 'privy',
  wallet_client_type: 'privy',
  wallet_index: 0,
};

function createUser(
  linkedAccounts: User['linked_accounts'],
  id = privyUserId,
): User {
  return {
    id,
    created_at: 1,
    has_accepted_terms: true,
    is_guest: false,
    linked_accounts: linkedAccounts,
    mfa_methods: [],
  };
}

describe('PrivyAuthService', () => {
  let service: PrivyAuthService;
  const verifyAccessToken = jest.fn();
  const verifyIdentityToken = jest.fn();
  const getUser = jest.fn();
  const clientMock = {
    utils: () => ({
      auth: () => ({
        verifyAccessToken,
        verifyIdentityToken,
      }),
    }),
    users: () => ({
      _get: getUser,
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    verifyAccessToken.mockResolvedValue(validClaims);
    verifyIdentityToken.mockResolvedValue(createUser([]));
    getUser.mockResolvedValue(
      createUser([emailAccount, stellarEmbeddedWallet]),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrivyAuthService,
        { provide: PRIVY_CLIENT, useValue: clientMock },
      ],
    }).compile();

    service = module.get(PrivyAuthService);
  });

  it('loads the complete user when the verified identity token omits its wallet', async () => {
    await expect(
      service.verifySession('access-token', 'identity-token'),
    ).resolves.toEqual({
      privyUserId,
      email: 'owner@empresa.com',
      stellarWalletAddress: 'GPRIVYWALLET',
    });
    expect(verifyAccessToken).toHaveBeenCalledWith('access-token');
    expect(verifyIdentityToken).toHaveBeenCalledWith('identity-token');
    expect(getUser).toHaveBeenCalledWith(privyUserId);
  });

  it('accepts a verified Google OAuth email and normalizes it', async () => {
    getUser.mockResolvedValue(
      createUser([
        {
          type: 'google_oauth',
          email: 'Google@Empresa.COM',
          first_verified_at: 1,
          latest_verified_at: 1,
          name: 'Owner',
          subject: 'google-subject',
          verified_at: 1,
        },
        stellarEmbeddedWallet,
      ]),
    );

    await expect(
      service.verifySession('access-token', 'identity-token'),
    ).resolves.toMatchObject({
      email: 'google@empresa.com',
    });
  });

  it('rejects identity tokens that belong to another Privy user', async () => {
    verifyIdentityToken.mockResolvedValue(
      createUser([], 'did:privy:other-user'),
    );

    await expect(
      service.verifySession('access-token', 'identity-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('rejects sessions without a verified email account', async () => {
    getUser.mockResolvedValue(createUser([stellarEmbeddedWallet]));

    await expect(
      service.verifySession('access-token', 'identity-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects sessions without a Privy Stellar embedded wallet', async () => {
    getUser.mockResolvedValue(createUser([emailAccount]));

    await expect(
      service.verifySession('access-token', 'identity-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an external Stellar wallet even when it has a usable address', async () => {
    const externalStellarWallet = {
      type: 'wallet',
      address: 'GEXTERNALWALLET',
      chain_type: 'stellar',
      wallet_client_type: 'external',
    } as unknown as User['linked_accounts'][number];
    getUser.mockResolvedValue(
      createUser([emailAccount, externalStellarWallet]),
    );

    await expect(
      service.verifySession('access-token', 'identity-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('turns full user lookup errors into UnauthorizedException', async () => {
    getUser.mockRejectedValue(new Error('failed to load Privy user'));

    await expect(
      service.verifySession('access-token', 'identity-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(getUser).toHaveBeenCalledWith(privyUserId);
  });

  it('turns SDK token verification errors into UnauthorizedException', async () => {
    verifyAccessToken.mockRejectedValue(new Error('invalid access token'));

    await expect(
      service.verifySession('access-token', 'identity-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects missing required tokens without invoking the SDK', async () => {
    await expect(
      service.verifySession('', 'identity-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(verifyAccessToken).not.toHaveBeenCalled();
    expect(verifyIdentityToken).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });
});

describe('privyClientProvider', () => {
  it('fails clearly when Privy server configuration is missing', () => {
    const config = new ConfigService({});

    expect(() => privyClientProvider.useFactory(config)).toThrow(
      'PRIVY_APP_ID and PRIVY_APP_SECRET must be configured',
    );
  });

  it('creates a client when the optional local verification key is omitted', () => {
    const config = new ConfigService({
      PRIVY_APP_ID: 'privy-app-id',
      PRIVY_APP_SECRET: 'privy-app-secret',
    });

    expect(() => privyClientProvider.useFactory(config)).not.toThrow();
  });
});
