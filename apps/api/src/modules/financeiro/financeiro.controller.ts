import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { FinanceiroService } from './financeiro.service';
import {
  CreateFormaDto,
  FaturaResumoDto,
  FormaRecebimentoDto,
  OkDto,
  ReceberDto,
  ReceberResultDto,
  RecebimentoDto,
  SaldoClienteDto,
  UpdateFormaDto,
} from './financeiro.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';
import { AuditService } from '../audit/audit.service';

@ApiTags('financeiro')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'gestor', 'financeiro', 'recepcao')
@Controller()
export class FinanceiroController {
  constructor(
    private readonly financeiro: FinanceiroService,
    private readonly audit: AuditService,
  ) {}

  @Get('faturas')
  @ApiQuery({ name: 'status', required: false, enum: ['aberta', 'parcial', 'paga', 'cancelada'] })
  @ApiOkResponse({ type: [FaturaResumoDto] })
  list(@Req() req: Request, @Query('status') status?: string): Promise<FaturaResumoDto[]> {
    return this.financeiro.listFaturas(req.auth!.tenantId, status);
  }

  @Post('faturas/:id/pagar')
  @ApiOkResponse({ type: OkDto })
  pagar(@Req() req: Request, @Param('id') id: string): Promise<OkDto> {
    return this.financeiro.pagar(req.auth!.tenantId, id);
  }

  @Post('faturas/:id/recebimentos')
  @ApiCreatedResponse({ type: ReceberResultDto })
  async receber(@Req() req: Request, @Param('id') id: string, @Body() dto: ReceberDto): Promise<ReceberResultDto> {
    const result = await this.financeiro.receber(req.auth!.tenantId, id, dto);
    await this.audit.registrar(req.auth!.tenantId, {
      userId: req.auth!.userId,
      acao: 'financeiro.receber',
      entidade: 'fatura',
      entidadeId: id,
      resumo: `Recebeu R$ ${(dto.valorCentavos / 100).toFixed(2)} — fatura ${result.status}`,
      detalhe: { valorCentavos: dto.valorCentavos, formaId: dto.formaId ?? null, status: result.status },
      ip: req.ip ?? null,
    });
    return result;
  }

  @Get('faturas/:id/recebimentos')
  @ApiOkResponse({ type: [RecebimentoDto] })
  recebimentos(@Req() req: Request, @Param('id') id: string): Promise<RecebimentoDto[]> {
    return this.financeiro.listRecebimentos(req.auth!.tenantId, id);
  }

  // Saldo do cliente (doc 13 §1)
  @Get('financeiro/saldos')
  @ApiOkResponse({ type: [SaldoClienteDto] })
  saldos(@Req() req: Request): Promise<SaldoClienteDto[]> {
    return this.financeiro.saldos(req.auth!.tenantId);
  }

  @Get('financeiro/saldos/:responsavelId')
  @ApiOkResponse({ type: SaldoClienteDto })
  saldoDe(@Req() req: Request, @Param('responsavelId') responsavelId: string): Promise<SaldoClienteDto> {
    return this.financeiro.saldoDe(req.auth!.tenantId, responsavelId);
  }

  // Formas de recebimento
  @Get('formas-recebimento')
  @ApiQuery({ name: 'incluirInativos', required: false, type: Boolean })
  @ApiOkResponse({ type: [FormaRecebimentoDto] })
  formas(@Req() req: Request, @Query('incluirInativos') incluirInativos?: string): Promise<FormaRecebimentoDto[]> {
    return this.financeiro.listFormas(req.auth!.tenantId, incluirInativos === 'true');
  }

  @Roles('admin', 'gestor', 'financeiro')
  @Post('formas-recebimento')
  @ApiCreatedResponse({ type: FormaRecebimentoDto })
  createForma(@Req() req: Request, @Body() dto: CreateFormaDto): Promise<FormaRecebimentoDto> {
    return this.financeiro.createForma(req.auth!.tenantId, dto);
  }

  @Roles('admin', 'gestor', 'financeiro')
  @Patch('formas-recebimento/:id')
  @ApiOkResponse({ type: FormaRecebimentoDto })
  updateForma(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateFormaDto): Promise<FormaRecebimentoDto> {
    return this.financeiro.updateForma(req.auth!.tenantId, id, dto);
  }
}
