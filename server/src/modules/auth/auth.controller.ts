import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, ForgotDto, ResetDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly svc: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    const user = await this.svc.register(body.email, body.password, body.name);
    // do not return password_hash
    // @ts-ignore
    delete user.password_hash;
    return user;
  }

  @Post('login')
  async login(@Body() body: LoginDto) {
    const user = await this.svc.validatePassword(body.email, body.password);
    if (!user) throw new BadRequestException('Invalid credentials');
    // simple response: user data (without hash)
    // @ts-ignore
    delete user.password_hash;
    return { user };
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
