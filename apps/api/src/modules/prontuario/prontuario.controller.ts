import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ProntuarioService } from './prontuario.service';
import {
  CreateEventoDto,
  EventoDto,
  FaturaDto,
  ProntuarioSignUploadDto,
  SignUploadResponseDto,
} from './prontuario.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('prontuario')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'gestor', 'veterinario', 'internacao')
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
    return this.prontuario.createEvento(req.auth!.tenantId, id, dto, req.auth!.userId);
  }

  // URL pré-assinada para anexar arquivo (documento/exame/vídeo) a um evento.
  @Post('animais/:id/prontuario/sign-upload')
  @ApiCreatedResponse({ type: SignUploadResponseDto })
  signAnexo(@Req() req: Request, @Param('id') id: string, @Body() dto: ProntuarioSignUploadDto): Promise<SignUploadResponseDto> {
    return this.prontuario.signAnexoUpload(req.auth!.tenantId, id, dto.contentType);
  }

  // Fatura aberta (consolidada) do responsável.
  @Roles('admin', 'gestor', 'recepcao', 'financeiro')
  @Get('clientes/:id/fatura')
  @ApiOkResponse({ type: FaturaDto })
  fatura(@Req() req: Request, @Param('id') id: string): Promise<FaturaDto | null> {
    return this.prontuario.getFaturaAberta(req.auth!.tenantId, id);
  }
}
