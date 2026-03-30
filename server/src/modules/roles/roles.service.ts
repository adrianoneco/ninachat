import { Injectable, OnModuleInit, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Role } from '../../entities/role.entity';
import { Permission } from '../../entities/permission.entity';
import { User } from '../../entities/user.entity';

const DEFAULT_PERMISSIONS = [
  { key: 'instances.manage', description: 'Create/update/delete/restart instances' },
  { key: 'messages.send', description: 'Send messages' },
  { key: 'messages.read', description: 'Read messages' },
  { key: 'contacts.sync', description: 'Sync contacts' },
  { key: 'users.manage', description: 'Manage users and roles' },
  { key: 'settings.manage', description: 'Manage system settings' },
  { key: 'reports.view', description: 'View reports' },
];

@Injectable()
export class RolesService implements OnModuleInit {
  constructor(
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(Permission) private permRepo: Repository<Permission>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  async onModuleInit() {
    // ensure default permissions exist
    for (const p of DEFAULT_PERMISSIONS) {
      const exists = await this.permRepo.findOne({ where: { key: p.key } as any });
      if (!exists) await this.permRepo.save(this.permRepo.create(p as any));
    }

    // ensure default roles
    const admin = await this.roleRepo.findOne({ where: { name: 'Administrador' } as any, relations: ['permissions'] });
    if (!admin) {
      const perms = await this.permRepo.find({ where: { key: In(DEFAULT_PERMISSIONS.map(p => p.key)) } });
      const r = this.roleRepo.create({ name: 'Administrador', description: 'Full access', permissions: perms } as any);
      await this.roleRepo.save(r);
    }
    const gerente = await this.roleRepo.findOne({ where: { name: 'Gerente' } as any });
    if (!gerente) {
      const perms = await this.permRepo.find({ where: { key: In(['reports.view', 'contacts.sync']) } });
      await this.roleRepo.save(this.roleRepo.create({ name: 'Gerente', description: 'Manager', permissions: perms } as any));
    }
    const supervisor = await this.roleRepo.findOne({ where: { name: 'Supervisor' } as any });
    if (!supervisor) {
      const perms = await this.permRepo.find({ where: { key: In(['messages.read', 'contacts.sync']) } });
      await this.roleRepo.save(this.roleRepo.create({ name: 'Supervisor', description: 'Supervisor', permissions: perms } as any));
    }
    const atendente = await this.roleRepo.findOne({ where: { name: 'Atendente' } as any });
    if (!atendente) {
      const perms = await this.permRepo.find({ where: { key: In(['messages.read', 'messages.send']) } });
      await this.roleRepo.save(this.roleRepo.create({ name: 'Atendente', description: 'Agent', permissions: perms } as any));
    }
  }

  listPermissions() {
    return this.permRepo.find();
  }

  listRoles() {
    return this.roleRepo.find({ relations: ['permissions'] });
  }

  async updateRolePermissions(roleId: string, permissionKeys: string[]) {
    const role = await this.roleRepo.findOne({ where: { id: roleId } as any, relations: ['permissions'] });
    if (!role) throw new BadRequestException('Role not found');
    const perms = await this.permRepo.find({ where: { key: In(permissionKeys || []) } });
    role.permissions = perms;
    await this.roleRepo.save(role);
    return this.roleRepo.findOne({ where: { id: roleId } as any, relations: ['permissions'] });
  }

  async ensureAdminNotLost(roleId: string, newPermKeys: string[]) {
    // If modifying Administrador role, ensure at least one user will keep admin capabilities
    const role = await this.roleRepo.findOne({ where: { id: roleId } as any });
    if (!role) return;
    if (role.name !== 'Administrador') return;
    // if removing admin privileges entirely, ensure at least one user has Administrator role or will have it
    const admins = await this.userRepo.createQueryBuilder('u').leftJoin('u.roles', 'r').where('r.name = :name', { name: 'Administrador' }).getMany();
    if (admins.length === 0 && (!newPermKeys || newPermKeys.length === 0)) {
      throw new BadRequestException('Cannot remove administrator permissions — no admin would remain');
    }
  }
}
