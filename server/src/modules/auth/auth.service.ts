import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { PasswordReset } from '../../entities/password-reset.entity';
import { Role } from '../../entities/role.entity';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import * as nodemailer from 'nodemailer';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(PasswordReset)
    private resetRepo: Repository<PasswordReset>,
    @InjectRepository(Role) private roleRepo: Repository<Role>,
  ) {}

  async register(email: string, password: string, name?: string) {
    const existing = await this.usersRepo.findOne({ where: { email } as any });
    if (existing) throw new BadRequestException('Email already registered');
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    const user = this.usersRepo.create({
      email,
      password_hash: hash,
      name,
    } as any);

    // If this is the first user, assign Administrador role (if exists)
    const total = await this.usersRepo.count();
    if (total === 0) {
      try {
        const adminRole = await this.roleRepo.findOne({
          where: { name: 'Administrador' } as any,
        });
        if (adminRole) {
          (user as any).roles = [adminRole];
        }
      } catch (e) {
        // ignore
      }
    }

    return this.usersRepo.save(user);
  }

  async validatePassword(email: string, password: string) {
    const user = await this.usersRepo.findOne({ where: { email } as any });
    if (!user || !user.password_hash) return null;
    const ok = await argon2.verify(user.password_hash, password);
    return ok ? user : null;
  }

  async generateReset(email: string) {
    const user = await this.usersRepo.findOne({ where: { email } as any });
    if (!user) throw new NotFoundException('User not found');
    const token = randomBytes(24).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
    const entry = this.resetRepo.create({
      user_id: user.id,
      token,
      expires_at: expires,
    } as any);
    await this.resetRepo.save(entry);
    // send email (if SMTP configured)
    const smtpHost = process.env.SMTP_HOST;
    if (smtpHost) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      });
      const resetUrl = `${process.env.APP_URL || 'http://localhost:4001'}/auth/reset?token=${token}`;
      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@example.com',
        to: user.email,
        subject: 'Password reset',
        text: `Use this link to reset your password: ${resetUrl}`,
        html: `<p>Use this link to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
      });
    } else {
      // fallback: log token
      console.log('Password reset token for', email, token);
    }
    return { ok: true };
  }

  async resetPassword(token: string, password: string) {
    const entry = await this.resetRepo.findOne({ where: { token } as any });
    if (!entry) throw new NotFoundException('Token not found');
    if (entry.expires_at && entry.expires_at < new Date())
      throw new BadRequestException('Token expired');
    const user = await this.usersRepo.findOne({
      where: { id: entry.user_id } as any,
    });
    if (!user) throw new NotFoundException('User not found');
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    await this.usersRepo.update(user.id, { password_hash: hash } as any);
    await this.resetRepo.delete(entry.id);
    return { ok: true };
  }
}
