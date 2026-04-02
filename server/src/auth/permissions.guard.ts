import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest();
    const userId = req.headers['x-user-id'] || req.headers['x-user'];
    if (!userId) throw new ForbiddenException('Missing user header');

    const user = await this.userRepo.findOne({
      where: { id: userId } as any,
      relations: ['roles', 'roles.permissions'],
    });
    if (!user) throw new ForbiddenException('User not found');

    const userPerms = new Set<string>();
    for (const r of user.roles || []) {
      for (const p of r.permissions || []) userPerms.add(p.key);
    }

    const ok = required.every((k) => userPerms.has(k));
    if (!ok) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
