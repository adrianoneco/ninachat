import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InstancesService } from './instances.service';

interface ActionResult {
  ok: boolean;
}

@ApiTags('Instâncias')
@Controller('instances')
export class InstancesController {
  constructor(private readonly svc: InstancesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas as instâncias' })
  @ApiResponse({ status: 200, description: 'Lista de instâncias retornada com sucesso' })
  async list() {
    return this.svc.findAll();
  }

  @Get('clients')
  @ApiOperation({ summary: 'Listar chaves de clientes conectados' })
  @ApiResponse({ status: 200, description: 'Lista de chaves de clientes' })
  async listClients() {
    return { clients: this.svc.listClientKeys() };
  }

  @Post()
  @ApiOperation({ summary: 'Criar nova instância' })
  @ApiResponse({ status: 201, description: 'Instância criada com sucesso' })
  async create(@Body() body: any) {
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
  @ApiOperation({ summary: 'Iniciar instância' })
  @ApiResponse({ status: 200, description: 'Instância iniciada com sucesso' })
  async start(@Param('id') id: string): Promise<ActionResult> {
    await this.svc.start(id);
    return { ok: true };
  }

  @Post(':id/test-status')
  @ApiOperation({ summary: 'Testar status da instância' })
  @ApiResponse({ status: 200, description: 'Status testado com sucesso' })
  async testStatus(@Param('id') id: string): Promise<any> {
    const res = await this.svc.setStatusForTest(id, 'connected');
    return res;
  }

  @Post(':id/stop')
  @ApiOperation({ summary: 'Parar instância' })
  @ApiResponse({ status: 200, description: 'Instância parada com sucesso' })
  async stop(@Param('id') id: string): Promise<ActionResult> {
    await this.svc.stop(id);
    return { ok: true };
  }

  @Post(':id/restart')
  @ApiOperation({ summary: 'Reiniciar instância' })
  @ApiResponse({ status: 200, description: 'Instância reiniciada com sucesso' })
  async restart(@Param('id') id: string): Promise<ActionResult> {
    await this.svc.restart(id);
    return { ok: true };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar instância' })
  @ApiResponse({ status: 200, description: 'Instância atualizada com sucesso' })
  async update(@Param('id') id: string, @Body() body: any) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover instância' })
  @ApiResponse({ status: 200, description: 'Instância removida com sucesso' })
  async remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
