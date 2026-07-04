import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { FiscalService } from './fiscal.service';
import {
  CancelarNotaDto,
  CriarNotaDto,
  FiscalConfigDto,
  NotaFiscalDto,
  UpdateFiscalConfigDto,
} from './fiscal.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/guards/roles.guard';

// Fiscal (doc 13 §3). Tenant vem sempre de req.auth. Restrito a admin/gestor/
// financeiro (alta sensibilidade regulatória).
@ApiTags('fiscal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Roles('admin', 'gestor', 'financeiro')
@Controller()
export class FiscalController {
  constructor(private readonly fiscal: FiscalService) {}

  @Get('fiscal/config')
  @ApiOkResponse({ type: FiscalConfigDto })
  getConfig(@Req() req: Request): Promise<FiscalConfigDto> {
    return this.fiscal.getConfig(req.auth!.tenantId);
  }

  @Put('fiscal/config')
  @ApiOkResponse({ type: FiscalConfigDto })
  updateConfig(@Req() req: Request, @Body() dto: UpdateFiscalConfigDto): Promise<FiscalConfigDto> {
    return this.fiscal.updateConfig(req.auth!.tenantId, dto);
  }

  @Get('fiscal/notas')
  @ApiQuery({ name: 'status', required: false, enum: ['rascunho', 'processando', 'emitida', 'rejeitada', 'cancelada'] })
  @ApiOkResponse({ type: [NotaFiscalDto] })
  listNotas(@Req() req: Request, @Query('status') status?: string): Promise<NotaFiscalDto[]> {
    return this.fiscal.listNotas(req.auth!.tenantId, status);
  }

  @Post('faturas/:faturaId/nota')
  @ApiCreatedResponse({ type: NotaFiscalDto })
  criar(@Req() req: Request, @Param('faturaId') faturaId: string, @Body() dto: CriarNotaDto): Promise<NotaFiscalDto> {
    return this.fiscal.criarDaFatura(req.auth!.tenantId, faturaId, dto.tipo ?? 'nfse');
  }

  @Post('fiscal/notas/:id/emitir')
  @HttpCode(200)
  @ApiOkResponse({ type: NotaFiscalDto })
  emitir(@Req() req: Request, @Param('id') id: string): Promise<NotaFiscalDto> {
    return this.fiscal.emitir(req.auth!.tenantId, id);
  }

  @Post('fiscal/notas/:id/cancelar')
  @HttpCode(200)
  @ApiOkResponse({ type: NotaFiscalDto })
  cancelar(@Req() req: Request, @Param('id') id: string, @Body() dto: CancelarNotaDto): Promise<NotaFiscalDto> {
    return this.fiscal.cancelar(req.auth!.tenantId, id, dto.motivo);
  }
}
