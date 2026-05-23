import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Headers,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { SetRoleDto } from './dto/set-role.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

interface AuthRequest {
  user: { userId: string; email: string; role: string | null };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('google')
  googleLogin(@Body() body: GoogleLoginDto) {
    return this.authService.googleLogin(body.idToken);
  }

  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('privy/session')
  privySession(
    @Headers('authorization') authorization: string | undefined,
    @Headers('privy-id-token') identityToken: string | undefined,
  ) {
    const bearerTokenMatch = authorization?.match(/^Bearer (\S+)$/);
    const accessToken = bearerTokenMatch?.[1];

    if (!accessToken || !identityToken || !/^\S+$/.test(identityToken)) {
      throw new UnauthorizedException('Privy session tokens are required');
    }

    return this.authService.privySession(accessToken, identityToken);
  }

  @Patch('me/role')
  @UseGuards(JwtAuthGuard)
  setRole(@Req() req: AuthRequest, @Body() body: SetRoleDto) {
    return this.authService.setRole(req.user.userId, body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: AuthRequest) {
    return this.authService.findMe(req.user.userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(@Req() req: AuthRequest, @Body() body: UpdateProfileDto) {
    return this.authService.updateProfile(req.user.userId, body);
  }

  @Patch('me/password')
  @UseGuards(JwtAuthGuard)
  changePassword(@Req() req: AuthRequest, @Body() body: ChangePasswordDto) {
    return this.authService.changePassword(req.user.userId, body);
  }

  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('stellar/challenge')
  getStellarChallenge(@Body() body: { stellarAddress: string }) {
    return this.authService.getStellarChallenge(body.stellarAddress);
  }

  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('stellar/verify')
  verifyStellarChallenge(@Body() body: { signedTransaction: string }) {
    return this.authService.verifyStellarChallenge(body.signedTransaction);
  }
}
