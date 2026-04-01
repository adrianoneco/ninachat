import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { GenericCrudService } from './generic-crud.service';

/**
 * Handles CRUD for simple resources that share the generic_records table.
 * Each resource gets its own REST path but they all go through the same service.
 */
@Controller()
export class GenericCrudController {
  constructor(private readonly svc: GenericCrudService) {}

  // ─── Team Members ──────────────────────────────────
  @Get('team_members')
  listTeamMembers(@Query() q: any) { return this.svc.findAll('team_members', q); }
  @Post('team_members')
  upsertTeamMember(@Body() body: any) { return this.svc.upsert('team_members', body); }
  @Delete('team_members/:id')
  deleteTeamMember(@Param('id') id: string) { return this.svc.remove('team_members', id); }

  // ─── Teams ─────────────────────────────────────────
  @Get('teams')
  listTeams(@Query() q: any) { return this.svc.findAll('teams', q); }
  @Post('teams')
  upsertTeam(@Body() body: any) { return this.svc.upsert('teams', body); }
  @Delete('teams/:id')
  deleteTeam(@Param('id') id: string) { return this.svc.remove('teams', id); }

  // ─── Team Functions ────────────────────────────────
  @Get('team_functions')
  listTeamFunctions(@Query() q: any) { return this.svc.findAll('team_functions', q); }
  @Post('team_functions')
  upsertTeamFunction(@Body() body: any) { return this.svc.upsert('team_functions', body); }
  @Delete('team_functions/:id')
  deleteTeamFunction(@Param('id') id: string) { return this.svc.remove('team_functions', id); }

  // ─── Deals ─────────────────────────────────────────
  @Get('deals')
  listDeals(@Query() q: any) { return this.svc.findAll('deals', q); }
  @Post('deals')
  upsertDeal(@Body() body: any) { return this.svc.upsert('deals', body); }
  @Delete('deals/:id')
  deleteDeal(@Param('id') id: string) { return this.svc.remove('deals', id); }

  // ─── Pipeline Stages ───────────────────────────────
  @Get('pipeline_stages')
  listPipelineStages(@Query() q: any) { return this.svc.findAll('pipeline_stages', q); }
  @Post('pipeline_stages')
  upsertPipelineStage(@Body() body: any) { return this.svc.upsert('pipeline_stages', body); }
  @Delete('pipeline_stages/:id')
  deletePipelineStage(@Param('id') id: string) { return this.svc.remove('pipeline_stages', id); }

  // ─── Deal Activities ───────────────────────────────
  @Get('deal_activities')
  listDealActivities(@Query() q: any) { return this.svc.findAll('deal_activities', q); }
  @Post('deal_activities')
  upsertDealActivity(@Body() body: any) { return this.svc.upsert('deal_activities', body); }
  @Delete('deal_activities/:id')
  deleteDealActivity(@Param('id') id: string) { return this.svc.remove('deal_activities', id); }

  // ─── Appointments ──────────────────────────────────
  @Get('appointments')
  listAppointments(@Query() q: any) { return this.svc.findAll('appointments', q); }
  @Post('appointments')
  upsertAppointment(@Body() body: any) { return this.svc.upsert('appointments', body); }
  @Delete('appointments/:id')
  deleteAppointment(@Param('id') id: string) { return this.svc.remove('appointments', id); }

  // ─── Tickets ───────────────────────────────────────
  @Get('tickets')
  listTickets(@Query() q: any) { return this.svc.findAll('tickets', q); }
  @Post('tickets')
  upsertTicket(@Body() body: any) { return this.svc.upsert('tickets', body); }
  @Delete('tickets/:id')
  deleteTicket(@Param('id') id: string) { return this.svc.remove('tickets', id); }

  // ─── Macros (global) ──────────────────────────────
  @Get('macros_global')
  listMacrosGlobal(@Query() q: any) { return this.svc.findAll('macros_global', q); }
  @Post('macros_global')
  upsertMacroGlobal(@Body() body: any) { return this.svc.upsert('macros_global', body); }
  @Delete('macros_global/:id')
  deleteMacroGlobal(@Param('id') id: string) { return this.svc.remove('macros_global', id); }

  // ─── Macros (user) ────────────────────────────────
  @Get('macros_by_user')
  listMacrosByUser(@Query() q: any) { return this.svc.findAll('macros_by_user', q); }
  @Post('macros_by_user')
  upsertMacroByUser(@Body() body: any) { return this.svc.upsert('macros_by_user', body); }
  @Delete('macros_by_user/:id')
  deleteMacroByUser(@Param('id') id: string) { return this.svc.remove('macros_by_user', id); }

  // ─── Assignment Rules ─────────────────────────────
  @Get('assignment_rules')
  listAssignmentRules(@Query() q: any) { return this.svc.findAll('assignment_rules', q); }
  @Post('assignment_rules')
  upsertAssignmentRule(@Body() body: any) { return this.svc.upsert('assignment_rules', body); }
  @Delete('assignment_rules/:id')
  deleteAssignmentRule(@Param('id') id: string) { return this.svc.remove('assignment_rules', id); }

  // ─── Sectors ───────────────────────────────────────
  @Get('sectors')
  listSectors(@Query() q: any) { return this.svc.findAll('sectors', q); }
  @Post('sectors')
  upsertSector(@Body() body: any) { return this.svc.upsert('sectors', body); }
  @Delete('sectors/:id')
  deleteSector(@Param('id') id: string) { return this.svc.remove('sectors', id); }

  // ─── Global Webhooks ──────────────────────────────
  @Get('global_webhooks')
  listGlobalWebhooks(@Query() q: any) { return this.svc.findAll('global_webhooks', q); }
  @Post('global_webhooks')
  upsertGlobalWebhook(@Body() body: any) { return this.svc.upsert('global_webhooks', body); }
  @Delete('global_webhooks/:id')
  deleteGlobalWebhook(@Param('id') id: string) { return this.svc.remove('global_webhooks', id); }

  // ─── System Settings ──────────────────────────────
  @Get('system_settings')
  async getSystemSettings() {
    const records = await this.svc.findAll('system_settings');
    if (records.length > 0) return records[0];
    // Return defaults if no settings saved yet
    return { sidebar_width: 320, site_name: 'Minha Empresa' };
  }
  @Post('system_settings')
  upsertSystemSettings(@Body() body: any) {
    // Use a fixed id so there's only one settings record
    return this.svc.upsert('system_settings', { ...body, id: body.id || 'main' });
  }
}
