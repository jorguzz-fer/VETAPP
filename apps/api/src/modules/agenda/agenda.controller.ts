import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AgendaService } from './agenda.service';
import { AgendamentoDto, CreateAgendamentoDto } from './agenda.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('agenda')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('agenda')
export class AgendaController {
  constructor(private readonly agenda: AgendaService) {}

  @Get()
  @ApiQuery({ name: 'from', required: false, description: 'ISO 8601' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO 8601' })
  @ApiOkResponse({ type: [AgendamentoDto] })
  list(@Req() req: Request, @Query('from') from?: string, @Query('to') to?: string): Promise<AgendamentoDto[]> {
    return this.agenda.list(req.auth!.tenantId, from, to);
  }

  @Post()
  @ApiCreatedResponse({ type: AgendamentoDto })
  create(@Req() req: Request, @Body() dto: CreateAgendamentoDto): Promise<AgendamentoDto> {
    return this.agenda.create(req.auth!.tenantId, dto);
  }

  @Delete(':id')
  @ApiOkResponse({ schema: { properties: { ok: { type: 'boolean' } } } })
  cancelar(@Req() req: Request, @Param('id') id: string): Promise<{ ok: boolean }> {
    return this.agenda.cancelar(req.auth!.tenantId, id);
  }
}
