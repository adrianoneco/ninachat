import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class ForgotDto {
  @IsEmail()
  email!: string;
}

export class ResetDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
