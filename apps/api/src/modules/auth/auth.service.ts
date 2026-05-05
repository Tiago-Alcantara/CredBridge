import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

const BCRYPT_ROUNDS = 10;

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

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
    return this.issueToken(user.id, user.email, user.role);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueToken(user.id, user.email, user.role);
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
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('Senha atual incorreta');
    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    return { message: 'ok' };
  }

  private async issueToken(sub: string, email: string, role: string) {
    const payload: JwtPayload = { sub, email, role };
    const accessToken = await this.jwt.signAsync(payload);
    return { accessToken, user: { id: sub, email, role } };
  }
}
