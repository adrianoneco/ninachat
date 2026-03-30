import { Controller, Get, Sse } from '@nestjs/common';
import { AppService } from './app.service';
import { Observable, interval } from 'rxjs';
import { map } from 'rxjs/operators';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('team_members')
  getTeamMembers() {
    // Lightweight mock response to satisfy frontend requests during development
    return [
      {
        id: 't1',
        name: 'Admin User',
        email: 'admin@empresa.com',
        role: 'admin',
        status: 'active',
        avatar: 'https://ui-avatars.com/api/?name=Admin+User&background=0891b2&color=fff',
        lastActive: new Date().toISOString(),
        team_id: 'team-1',
      },
    ];
  }

  @Get('system_settings')
  getSystemSettings() {
    return {
      sidebar_width: 320,
      site_name: 'Minha Empresa',
    };
  }

  @Get('tag_definitions')
  getTagDefinitions() {
    return [
      { id: 't1', key: 'aguardando', label: 'Aguardando', color: 'amber' },
      { id: 't2', key: 'agendado', label: 'Agendado', color: 'emerald' },
    ];
  }

  @Get('teams')
  getTeams() {
    return [
      { id: 'team-1', name: 'Suporte' },
      { id: 'team-2', name: 'Vendas' },
    ];
  }

  @Get('company')
  getCompany() {
    return { id: 'company-1', name: 'Minha Empresa', logo: null };
  }

  @Get('nina_settings')
  getNinaSettings() {
    return { sdrName: 'Nina', enabled: true };
  }

  @Get('deals')
  getDeals() {
    return [];
  }

  // Simple Server-Sent Events endpoint for /events
  @Sse('events')
  events(): Observable<any> {
    // emit a ping every 15 seconds to keep the connection alive
    return interval(15000).pipe(map(() => ({ data: { type: 'ping', ts: Date.now() } })));
  }
}
