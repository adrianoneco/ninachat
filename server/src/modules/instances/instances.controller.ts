import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { InstancesService } from './instances.service';

interface ActionResult { ok: boolean; }

@Controller('instances')
export class InstancesController {
  constructor(private readonly svc: InstancesService) {}

  @Get()
  async list() {
    return this.svc.findAll();
  }

  @Post()
  async create(@Body() body: any) {
    // Accept either a single instance or an array (frontend sends full list on save).
    if (Array.isArray(body)) {
      const results: any[] = [];
      for (const item of body) {
        results.push(await this.svc.create(item));
      }
      return results;
    }
    return this.svc.create(body);
  }

  @Post(':id/start')
  async start(@Param('id') id: string): Promise<ActionResult> {
    await this.svc.start(id);
    return { ok: true };
  }

  @Post(':id/test-status')
  async testStatus(@Param('id') id: string): Promise<any> {
    // test endpoint to force a 'connected' status and trigger notifications
    const res = await this.svc.setStatusForTest(id, 'connected');
    return res;
  }

  @Post(':id/stop')
  async stop(@Param('id') id: string): Promise<ActionResult> {
    await this.svc.stop(id);
    return { ok: true };
  }

  @Post(':id/restart')
  async restart(@Param('id') id: string): Promise<ActionResult> {
    await this.svc.restart(id);
    return { ok: true };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
