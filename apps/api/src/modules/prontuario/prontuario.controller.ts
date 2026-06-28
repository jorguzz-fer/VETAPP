import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ProntuarioService } from './prontuario.service';
import { CreateEventoDto, EventoDto, FaturaDto } from './prontuario.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('prontuario')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ProntuarioController {
  constructor(private readonly prontuario: ProntuarioService) {}

  @Get('animais/:id/eventos')
  @ApiOkResponse({ type: [EventoDto] })
  eventos(@Req() req: Request, @Param('id') id: string): Promise<EventoDto[]> {
    return this.prontuario.listEventos(req.auth!.tenantId, id);
  }

  @Post('animais/:id/eventos')
  @ApiCreatedResponse({ type: EventoDto })
  addEvento(@Req() req: Request, @Param('id') id: string, @Body() dto: CreateEventoDto): Promise<EventoDto> {
    return this.prontuario.createEvento(req.auth!.tenantId, id, dto);
  }

  // Fatura aberta (consolidada) do responsável.
  @Get('clientes/:id/fatura')
  @ApiOkResponse({ type: FaturaDto })
  fatura(@Req() req: Request, @Param('id') id: string): Promise<FaturaDto | null> {
    return this.prontuario.getFaturaAberta(req.auth!.tenantId, id);
  }
}
