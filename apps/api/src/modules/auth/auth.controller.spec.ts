import { RequestMethod, UnauthorizedException } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import {
  THROTTLER_LIMIT,
  THROTTLER_TTL,
} from '@nestjs/throttler/dist/throttler.constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

jest.mock('./auth.service', () => ({
  AuthService: class AuthService {},
}));

describe('AuthController', () => {
  const authServiceMock = {
    privySession: jest.fn(),
  };
  let controller: AuthController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AuthController(authServiceMock as unknown as AuthService);
  });

  describe('privySession', () => {
    it.each([
      [undefined, 'identity-token'],
      ['Basic access-token', 'identity-token'],
      ['Bearer ', 'identity-token'],
      ['Bearer access token', 'identity-token'],
      ['Bearer access-token', undefined],
      ['Bearer access-token', ''],
      ['Bearer access-token', ' identity-token'],
      ['Bearer access-token', 'identity token'],
    ])(
      'rejects absent or malformed session headers without calling the service',
      (authorization, identityToken) => {
        expect(() =>
          controller.privySession(authorization, identityToken),
        ).toThrow(UnauthorizedException);
        expect(authServiceMock.privySession).not.toHaveBeenCalled();
      },
    );

    it('passes valid access and identity tokens to the auth service', async () => {
      authServiceMock.privySession.mockResolvedValue({ accessToken: 'jwt' });

      await expect(
        controller.privySession('Bearer access-token', 'identity-token'),
      ).resolves.toEqual({ accessToken: 'jwt' });
      expect(authServiceMock.privySession).toHaveBeenCalledWith(
        'access-token',
        'identity-token',
      );
    });

    it('exposes POST /auth/privy/session with the federated login throttle', () => {
      const handler = AuthController.prototype.privySession;
      const controllerPath = Reflect.getMetadata(PATH_METADATA, AuthController);
      const routePath = Reflect.getMetadata(PATH_METADATA, handler);

      expect(`/${controllerPath}/${routePath}`).toBe('/auth/privy/session');
      expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
        RequestMethod.POST,
      );
      expect(Reflect.getMetadata(`${THROTTLER_LIMIT}default`, handler)).toBe(
        10,
      );
      expect(Reflect.getMetadata(`${THROTTLER_TTL}default`, handler)).toBe(
        60000,
      );
    });
  });
});
