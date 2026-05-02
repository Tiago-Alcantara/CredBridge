import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const ROLES = ['pme', 'investor', 'partner'] as const;

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsIn(ROLES)
  role?: 'pme' | 'investor' | 'partner';
}
