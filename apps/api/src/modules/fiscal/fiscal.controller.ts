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
import { Roles, RolesGuard } from '../../common/guards/roles.guard';
import { AuditService } from '../audit/audit.service';

// Fiscal (doc 13 §3). Tenant vem sempre de req.auth. Restrito a admin/gestor/
// financeiro (alta sensibilidade regulatória). Ordem dos guards importa: o
// JwtAuthGuard popula req.auth ANTES do RolesGuard lê-lo.
@ApiTags('fiscal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'gestor', 'financeiro')
@Controller()
export class FiscalController {
  constructor(
    private readonly fiscal: FiscalService,
    private readonly audit: AuditService,
  ) {}

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
  async emitir(@Req() req: Request, @Param('id') id: string): Promise<NotaFiscalDto> {
    const nota = await this.fiscal.emitir(req.auth!.tenantId, id);
    await this.audit.registrar(req.auth!.tenantId, {
      userId: req.auth!.userId,
      acao: 'fiscal.emitir',
      entidade: 'nota_fiscal',
      entidadeId: nota.id,
      resumo: `Emitiu nota ${nota.numero ? `nº ${nota.numero}` : '(sem número)'} — status ${nota.status}`,
      detalhe: { numero: nota.numero, serie: nota.serie, status: nota.status, valorCentavos: nota.valorCentavos },
      ip: req.ip ?? null,
    });
    return nota;
  }

  @Post('fiscal/notas/:id/cancelar')
  @HttpCode(200)
  @ApiOkResponse({ type: NotaFiscalDto })
  async cancelar(@Req() req: Request, @Param('id') id: string, @Body() dto: CancelarNotaDto): Promise<NotaFiscalDto> {
    const nota = await this.fiscal.cancelar(req.auth!.tenantId, id, dto.motivo);
    await this.audit.registrar(req.auth!.tenantId, {
      userId: req.auth!.userId,
      acao: 'fiscal.cancelar',
      entidade: 'nota_fiscal',
      entidadeId: nota.id,
      resumo: `Cancelou nota ${nota.numero ? `nº ${nota.numero}` : ''}`.trim(),
      detalhe: { motivo: dto.motivo },
      ip: req.ip ?? null,
    });
    return nota;
  }
}
