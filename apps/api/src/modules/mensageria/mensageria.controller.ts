import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { MensageriaService } from './mensageria.service';
import { CreateMensagemDto, MensagemDto } from './mensageria.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';

// Mensageria / CRM (doc 17). Ver = qualquer staff; registrar = recepção/gestão/clínico;
// histórico geral (CRM) = admin/gestor.
@ApiTags('mensageria')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class MensageriaController {
  constructor(private readonly mensageria: MensageriaService) {}

  @Get('clientes/:id/mensagens')
  @ApiOkResponse({ type: [MensagemDto] })
  listPorCliente(@Req() req: Request, @Param('id') id: string): Promise<MensagemDto[]> {
    return this.mensageria.listPorCliente(req.auth!.tenantId, id);
  }

  @Roles('admin', 'gestor', 'recepcao', 'veterinario')
  @Post('clientes/:id/mensagens')
  @ApiCreatedResponse({ type: MensagemDto })
  registrar(@Req() req: Request, @Param('id') id: string, @Body() dto: CreateMensagemDto): Promise<MensagemDto> {
    return this.mensageria.registrarParaCliente(req.auth!.tenantId, id, req.auth!.userId, dto);
  }

  @Roles('admin', 'gestor')
  @Get('mensagens')
  @ApiQuery({ name: 'canal', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiOkResponse({ type: [MensagemDto] })
  listGeral(
    @Req() req: Request,
    @Query('canal') canal?: string,
    @Query('status') status?: string,
  ): Promise<MensagemDto[]> {
    return this.mensageria.listGeral(req.auth!.tenantId, { canal, status });
  }
}
