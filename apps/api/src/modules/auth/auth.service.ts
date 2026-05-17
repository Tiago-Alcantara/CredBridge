import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { BLOCKCHAIN_SERVICE } from '../../shared/blockchain/blockchain.interface';
import type { BlockchainService } from '../../shared/blockchain/blockchain.interface';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SetRoleDto } from './dto/set-role.dto';

const BCRYPT_ROUNDS = 10;

export interface JwtPayload {
  sub: string;
  email: string;
  role: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClient: OAuth2Client;
  private readonly googleClientId: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(BLOCKCHAIN_SERVICE) private readonly blockchain: BlockchainService,
  ) {
    this.googleClientId = this.config.get<string>('GOOGLE_CLIENT_ID') ?? '';
    this.googleClient = new OAuth2Client(this.googleClientId);
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: dto.role ?? 'pme',
      },
    });

    try {
      const stellarWalletId = await this.blockchain.createCustodialWallet(user.id);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { stellarWalletId },
      });
    } catch (err) {
      this.logger.warn(`Wallet creation failed for user ${user.id}: ${(err as Error).message}`);
    }

    return this.issueToken(user.id, user.email, user.role);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueToken(user.id, user.email, user.role);
  }

  async googleLogin(idToken: string) {
    if (!this.googleClientId) {
      throw new BadRequestException('Google login not configured');
    }

    let payload;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.googleClientId,
      });
      payload = ticket.getPayload();
    } catch (err) {
      this.logger.warn(`Google ID token verification failed: ${(err as Error).message}`);
      throw new UnauthorizedException('Invalid Google credentials');
    }

    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('Invalid Google credentials');
    }
    if (!payload.email_verified) {
      throw new ForbiddenException('Google email not verified');
    }

    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name ?? null;

    let user = await this.prisma.user.findUnique({ where: { googleId } });

    if (!user) {
      user = await this.prisma.user.findUnique({ where: { email } });
      if (user) {
        if (!user.googleId) {
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: { googleId },
          });
        }
      } else {
        user = await this.prisma.user.create({
          data: {
            email,
            googleId,
            provider: 'google',
            name,
            role: null,
          },
        });
      }
    }

    let stellarWalletId = user.stellarWalletId;
    if (!stellarWalletId) {
      try {
        stellarWalletId = await this.blockchain.createCustodialWallet(googleId);
        await this.prisma.user.update({
          where: { id: user.id },
          data: { stellarWalletId },
        });
      } catch (err) {
        this.logger.warn(`Wallet creation failed for user ${user.id}: ${(err as Error).message}`);
      }
    }

    const tokenResult = await this.issueToken(user.id, user.email, user.role);
    return {
      ...tokenResult,
      user: { ...tokenResult.user, stellarWalletId: stellarWalletId ?? null },
      needsRoleSelection: user.role === null,
    };
  }

  async setRole(userId: string, dto: SetRoleDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (user.role) {
      throw new ConflictException('Role already set');
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role: dto.role },
    });
    return this.issueToken(updated.id, updated.email, updated.role);
  }

  async getStellarChallenge(stellarAddress: string): Promise<{ challenge: string }> {
    this.logger.log(`getStellarChallenge for: ${stellarAddress}`);
    return { challenge: `challenge-${Date.now()}` };
  }

  async verifyStellarChallenge(signedTransaction: string): Promise<{ token: string }> {
    this.logger.log('verifyStellarChallenge called');
    return { token: `jwt-${Date.now()}` };
  }

  private readonly userSelect = {
    id: true,
    email: true,
    role: true,
    name: true,
    phone: true,
    address: true,
    companyName: true,
    cnpj: true,
    monthlyRevenue: true,
    sector: true,
    investorType: true,
    riskProfile: true,
    operationalLimit: true,
    stellarWalletId: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  async findMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: this.userSelect,
    });
    if (!user) throw new UnauthorizedException();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _pw, ...safe } = user as typeof user & { passwordHash?: string };
    return safe;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: this.userSelect,
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _pw, ...safe } = user as typeof user & { passwordHash?: string };
    return safe;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (!user.passwordHash) {
      throw new BadRequestException('Conta sem senha cadastrada');
    }
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('Senha atual incorreta');
    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    return { message: 'ok' };
  }

  private async issueToken(sub: string, email: string, role: string | null) {
    const payload: JwtPayload = { sub, email, role };
    const accessToken = await this.jwt.signAsync(payload);
    return { accessToken, user: { id: sub, email, role } };
  }
}
