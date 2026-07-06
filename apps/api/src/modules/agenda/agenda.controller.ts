import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AgendaService } from './agenda.service';
import {
  AgendamentoDto,
  CreateAgendamentoDto,
  CreateTipoAtendimentoDto,
  ProfissionalDto,
  TipoAtendimentoDto,
  UpdateStatusDto,
  UpdateTipoAtendimentoDto,
} from './agenda.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('agenda')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('agenda')
export class AgendaController {
  constructor(private readonly agenda: AgendaService) {}

  @Get()
  @ApiQuery({ name: 'from', required: false, description: 'ISO 8601' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO 8601' })
  @ApiQuery({ name: 'profissionalId', required: false, description: 'Filtra por profissional ("minha agenda")' })
  @ApiOkResponse({ type: [AgendamentoDto] })
  list(
    @Req() req: Request,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('profissionalId') profissionalId?: string,
  ): Promise<AgendamentoDto[]> {
    return this.agenda.list(req.auth!.tenantId, from, to, profissionalId);
  }

  @Roles('admin', 'gestor', 'recepcao', 'veterinario')
  @Post()
  @ApiCreatedResponse({ type: AgendamentoDto })
  create(@Req() req: Request, @Body() dto: CreateAgendamentoDto): Promise<AgendamentoDto> {
    return this.agenda.create(req.auth!.tenantId, dto);
  }

  @Get('profissionais')
  @ApiOkResponse({ type: [ProfissionalDto] })
  profissionais(@Req() req: Request): Promise<ProfissionalDto[]> {
    return this.agenda.listProfissionais(req.auth!.tenantId);
  }

  @Get('tipos')
  @ApiQuery({ name: 'incluirInativos', required: false, type: Boolean })
  @ApiOkResponse({ type: [TipoAtendimentoDto] })
  tipos(@Req() req: Request, @Query('incluirInativos') incluirInativos?: string): Promise<TipoAtendimentoDto[]> {
    return this.agenda.listTipos(req.auth!.tenantId, incluirInativos === 'true');
  }

  @Roles('admin', 'gestor')
  @Post('tipos')
  @ApiCreatedResponse({ type: TipoAtendimentoDto })
  createTipo(@Req() req: Request, @Body() dto: CreateTipoAtendimentoDto): Promise<TipoAtendimentoDto> {
    return this.agenda.createTipo(req.auth!.tenantId, dto);
  }

  @Roles('admin', 'gestor')
  @Patch('tipos/:id')
  @ApiOkResponse({ type: TipoAtendimentoDto })
  updateTipo(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateTipoAtendimentoDto,
  ): Promise<TipoAtendimentoDto> {
    return this.agenda.updateTipo(req.auth!.tenantId, id, dto);
  }

  @Roles('admin', 'gestor', 'recepcao', 'veterinario')
  @Patch(':id/status')
  @ApiOkResponse({ schema: { properties: { ok: { type: 'boolean' } } } })
  updateStatus(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateStatusDto): Promise<{ ok: boolean }> {
    return this.agenda.updateStatus(req.auth!.tenantId, id, dto.status);
  }

  @Roles('admin', 'gestor', 'recepcao')
  @Delete(':id')
  @ApiOkResponse({ schema: { properties: { ok: { type: 'boolean' } } } })
  cancelar(@Req() req: Request, @Param('id') id: string): Promise<{ ok: boolean }> {
    return this.agenda.cancelar(req.auth!.tenantId, id);
  }
}
