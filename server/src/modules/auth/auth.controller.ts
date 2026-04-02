import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, ForgotDto, ResetDto } from './dto';
import { createToken } from './token.service';

@Controller('auth')
export class AuthController {
  private logger = new Logger('AuthController');

  constructor(private readonly svc: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    try {
      this.logger.log(`Registering user: ${body.email}`);
      const user = await this.svc.register(
        body.email,
        body.password,
        body.name,
      );
      if (!user) throw new BadRequestException('Failed to register user');

      const userId = (user as any).id;
      if (!userId) throw new BadRequestException('User ID not found');

      delete (user as any).password_hash;
      const token = createToken(userId);
      this.logger.log(`User registered successfully: ${body.email}`);
      return { ...user, access_token: token };
    } catch (error) {
      this.logger.error(
        `Registration error for ${body.email}: ${error.message}`,
      );
      throw error;
    }
  }

  @Post('login')
  async login(@Body() body: LoginDto) {
    try {
      this.logger.log(`Login attempt: ${body.email}`);
      const user = await this.svc.validatePassword(body.email, body.password);
      if (!user) {
        this.logger.warn(`Login failed - invalid credentials: ${body.email}`);
        throw new BadRequestException('Invalid credentials');
      }

      const userId = (user as any).id;
      if (!userId) throw new BadRequestException('User ID not found');

      delete (user as any).password_hash;
      const token = createToken(userId);
      this.logger.log(`Login successful: ${body.email}`);
      return { ...user, access_token: token };
    } catch (error) {
      this.logger.error(`Login error for ${body.email}: ${error.message}`);
      throw error;
    }
  }

  @Post('forgot')
  async forgot(@Body() body: ForgotDto) {
    return this.svc.generateReset(body.email);
  }

  @Post('reset')
  async reset(@Body() body: ResetDto) {
    return this.svc.resetPassword(body.token, body.password);
  }
}
