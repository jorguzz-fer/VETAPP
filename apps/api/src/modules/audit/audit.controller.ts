import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuditService } from './audit.service';
import { AuditLogPageDto } from './audit.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';

// Consulta da trilha de auditoria (doc 07: Auditoria/Log = admin). Só leitura —
// a tabela é append-only. Ordem dos guards: JwtAuthGuard popula req.auth antes
// do RolesGuard lê-lo.
@ApiTags('auditoria')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('auditoria')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiQuery({ name: 'entidade', required: false, type: String })
  @ApiQuery({ name: 'acao', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiOkResponse({ type: AuditLogPageDto })
  list(
    @Req() req: Request,
    @Query('entidade') entidade?: string,
    @Query('acao') acao?: string,
    @Query('userId') userId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<AuditLogPageDto> {
    return this.audit.list(req.auth!.tenantId, {
      entidade: entidade || undefined,
      acao: acao || undefined,
      userId: userId || undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }
}
