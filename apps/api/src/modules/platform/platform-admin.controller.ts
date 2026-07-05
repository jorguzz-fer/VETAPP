import { Body, Controller, Get, HttpCode, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PlatformGuard } from './platform.guard';
import { PlatformAuditService } from './platform-audit.service';
import { PlatformTenantsService } from './platform-tenants.service';
import { AssinaturasService } from '../assinaturas/assinaturas.service';
import { PlanosService } from '../assinaturas/planos.service';
import {
  AssinaturaDto,
  AtualizarAssinaturaDto,
  AtualizarPlanoDto,
  ClinicaResumoDto,
  CriarPlanoDto,
  KpisDto,
  PlanoDto,
  ProvisionarClinicaDto,
  ProvisionarClinicaResultDto,
} from './platform-admin.dto';

// Back-office do super-admin (doc 15). Tudo sob PlatformGuard (escopo 'platform') e
// auditado em platform_audit_log. Namespace /api/platform.
@ApiTags('platform')
@ApiBearerAuth()
@UseGuards(PlatformGuard)
@Controller('platform')
export class PlatformAdminController {
  constructor(
    private readonly assinaturas: AssinaturasService,
    private readonly planos: PlanosService,
    private readonly tenants: PlatformTenantsService,
    private readonly audit: PlatformAuditService,
  ) {}

  // ── Clínicas (tenants) ──
  @Get('clinicas')
  @ApiOkResponse({ type: [ClinicaResumoDto] })
  clinicas(): Promise<ClinicaResumoDto[]> {
    return this.assinaturas.listarClinicas();
  }

  @Get('clinicas/:tenantId/assinatura')
  @ApiOkResponse({ type: AssinaturaDto })
  async assinatura(@Param('tenantId') tenantId: string): Promise<AssinaturaDto> {
    const a = await this.assinaturas.getByTenant(tenantId);
    return {
      tenantId,
      planoId: a?.planoId ?? null,
      status: a?.status ?? 'sem-assinatura',
      precoCentavos: a?.precoCentavos ?? 0,
      ciclo: a?.ciclo ?? 'mensal',
      vigenteAte: a?.vigenteAte ?? null,
      trialAte: a?.trialAte ?? null,
      observacao: a?.observacao ?? null,
    };
  }

  @Put('clinicas/:tenantId/assinatura')
  @ApiOkResponse({ type: AssinaturaDto })
  async atualizarAssinatura(
    @Req() req: Request,
    @Param('tenantId') tenantId: string,
    @Body() dto: AtualizarAssinaturaDto,
  ): Promise<AssinaturaDto> {
    const row = await this.assinaturas.atualizar(tenantId, dto);
    await this.audit.registrar({
      adminId: req.platformAdmin!.adminId,
      acao: 'assinatura.atualizar',
      entidade: 'assinatura',
      entidadeId: tenantId,
      resumo: `Atualizou assinatura da clínica${dto.status ? ` → ${dto.status}` : ''}`,
      detalhe: { ...dto },
      ip: req.ip ?? null,
    });
    return {
      tenantId,
      planoId: row.planoId,
      status: row.status,
      precoCentavos: row.precoCentavos,
      ciclo: row.ciclo,
      vigenteAte: row.vigenteAte,
      trialAte: row.trialAte,
      observacao: row.observacao,
    };
  }

  @Post('clinicas/:tenantId/assinatura/pagar')
  @HttpCode(200)
  @ApiOkResponse({ type: AssinaturaDto })
  async marcarPago(@Req() req: Request, @Param('tenantId') tenantId: string): Promise<AssinaturaDto> {
    const row = await this.assinaturas.marcarPago(tenantId);
    await this.audit.registrar({
      adminId: req.platformAdmin!.adminId,
      acao: 'assinatura.pagar',
      entidade: 'assinatura',
      entidadeId: tenantId,
      resumo: `Registrou pagamento — vigente até ${row.vigenteAte}`,
      ip: req.ip ?? null,
    });
    return {
      tenantId,
      planoId: row.planoId,
      status: row.status,
      precoCentavos: row.precoCentavos,
      ciclo: row.ciclo,
      vigenteAte: row.vigenteAte,
      trialAte: row.trialAte,
      observacao: row.observacao,
    };
  }

  @Post('clinicas')
  @ApiOkResponse({ type: ProvisionarClinicaResultDto })
  async provisionar(@Req() req: Request, @Body() dto: ProvisionarClinicaDto): Promise<ProvisionarClinicaResultDto> {
    const result = await this.tenants.provisionar(dto.nome, dto.adminEmail, dto.adminNome);
    await this.audit.registrar({
      adminId: req.platformAdmin!.adminId,
      acao: 'clinica.provisionar',
      entidade: 'tenant',
      entidadeId: result.tenantId,
      resumo: `Provisionou a clínica "${dto.nome}" (admin ${dto.adminEmail})`,
      ip: req.ip ?? null,
    });
    return result;
  }

  // ── Planos ──
  @Get('planos')
  @ApiOkResponse({ type: [PlanoDto] })
  listPlanos(): Promise<PlanoDto[]> {
    return this.planos.list();
  }

  @Post('planos')
  @ApiOkResponse({ type: PlanoDto })
  async criarPlano(@Req() req: Request, @Body() dto: CriarPlanoDto): Promise<PlanoDto> {
    const row = await this.planos.criar(dto);
    await this.audit.registrar({
      adminId: req.platformAdmin!.adminId,
      acao: 'plano.criar',
      entidade: 'plano',
      entidadeId: row.id,
      resumo: `Criou o plano "${row.nome}"`,
      ip: req.ip ?? null,
    });
    return row;
  }

  @Put('planos/:id')
  @ApiOkResponse({ type: PlanoDto })
  async atualizarPlano(@Req() req: Request, @Param('id') id: string, @Body() dto: AtualizarPlanoDto): Promise<PlanoDto> {
    const row = await this.planos.atualizar(id, dto);
    await this.audit.registrar({
      adminId: req.platformAdmin!.adminId,
      acao: 'plano.atualizar',
      entidade: 'plano',
      entidadeId: id,
      resumo: `Atualizou o plano "${row.nome}"`,
      ip: req.ip ?? null,
    });
    return row;
  }

  // ── KPIs ──
  @Get('kpis')
  @ApiOkResponse({ type: KpisDto })
  kpis(): Promise<KpisDto> {
    return this.assinaturas.kpis();
  }
}
