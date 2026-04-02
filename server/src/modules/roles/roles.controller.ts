import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common';
import { RolesService } from './roles.service';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Permissions } from '../../auth/permissions.decorator';

@Controller('roles')
export class RolesController {
  constructor(private readonly svc: RolesService) {}

  @Get('permissions')
  async permissions() {
    return this.svc.listPermissions();
  }

  @Get()
  async roles() {
    return this.svc.listRoles();
  }

  @Put(':id/permissions')
  @UseGuards(PermissionsGuard)
  @Permissions('users.manage')
  async updatePermissions(
    @Param('id') id: string,
    @Body() body: { keys: string[] },
  ) {
    await this.svc.ensureAdminNotLost(id, body.keys);
    return this.svc.updateRolePermissions(id, body.keys || []);
  }
}
