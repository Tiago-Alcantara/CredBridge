import {
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

  private async issueToken(sub: string, email: string, role: string) {
    const payload: JwtPayload = { sub, email, role };
    const accessToken = await this.jwt.signAsync(payload);
    return { accessToken, user: { id: sub, email, role } };
  }
}
