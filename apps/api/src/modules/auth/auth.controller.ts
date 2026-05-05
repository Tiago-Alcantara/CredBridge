import { Controller, Post, Get, Patch, Body, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

interface AuthRequest {
  user: { userId: string; email: string; role: string };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
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

  @Post('stellar/challenge')
  getStellarChallenge(@Body() body: { stellarAddress: string }) {
    return this.authService.getStellarChallenge(body.stellarAddress);
  }

  @Post('stellar/verify')
  verifyStellarChallenge(@Body() body: { signedTransaction: string }) {
    return this.authService.verifyStellarChallenge(body.signedTransaction);
  }
}
