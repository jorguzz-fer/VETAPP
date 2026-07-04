import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { LgpdService } from './lgpd.service';
import { LgpdExportDto } from './lgpd.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';
import { AuditService } from '../audit/audit.service';

// Exportação de dados do titular (LGPD — doc 09 §5). PII em massa: restrito a
// admin/gestor e auditado. Ordem dos guards: JwtAuthGuard popula req.auth antes
// do RolesGuard.
@ApiTags('lgpd')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'gestor')
@Controller('lgpd')
export class LgpdController {
  constructor(
    private readonly lgpd: LgpdService,
    private readonly audit: AuditService,
  ) {}

  @Get('clientes/:responsavelId/export')
  @ApiOkResponse({ type: LgpdExportDto })
  async export(@Req() req: Request, @Param('responsavelId') responsavelId: string): Promise<LgpdExportDto> {
    const data = await this.lgpd.exportarTitular(req.auth!.tenantId, responsavelId);
    await this.audit.registrar(req.auth!.tenantId, {
      userId: req.auth!.userId,
      acao: 'lgpd.exportar',
      entidade: 'responsavel',
      entidadeId: responsavelId,
      resumo: `Exportou os dados do titular (${data.animais.length} pets, ${data.faturas.length} faturas)`,
      ip: req.ip ?? null,
    });
    return data;
  }
}
