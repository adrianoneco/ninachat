import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Get('metrics')
  getMetrics(@Query('days') days = '7') {
    return this.svc.getMetrics(parseInt(days, 10) || 7);
  }

  @Get('chart')
  getChart(@Query('days') days = '7') {
    return this.svc.getChart(parseInt(days, 10) || 7);
  }

  @Get('full')
  getFull(
    @Query('days') days = '30',
    @Query('instanceId') instanceId?: string,
    @Query('agentId') agentId?: string,
  ) {
    return this.svc.getFull(parseInt(days, 10) || 30, instanceId, agentId);
  }
}
