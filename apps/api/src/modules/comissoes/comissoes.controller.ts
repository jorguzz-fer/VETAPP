import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ComissoesService } from './comissoes.service';
import { ApuracaoColaboradorDto, ApuracaoLinhaDto, CreateRegraDto, RegraDto } from './comissoes.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('comissoes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'gestor', 'financeiro')
@Controller('comissoes')
export class ComissoesController {
  constructor(private readonly comissoes: ComissoesService) {}

  @Get()
  @ApiQuery({ name: 'from', required: false, description: 'ISO 8601' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO 8601' })
  @ApiOkResponse({ type: [ApuracaoColaboradorDto] })
  apurar(@Req() req: Request, @Query('from') from?: string, @Query('to') to?: string): Promise<ApuracaoColaboradorDto[]> {
    return this.comissoes.apurar(req.auth!.tenantId, from, to);
  }

  /** "Minhas comissões" — extrato do usuário logado (doc 05 §5.3). */
  @Roles('admin', 'gestor', 'recepcao', 'veterinario', 'internacao', 'financeiro')
  @Get('minhas')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiOkResponse({ type: [ApuracaoLinhaDto] })
  minhas(@Req() req: Request, @Query('from') from?: string, @Query('to') to?: string): Promise<ApuracaoLinhaDto[]> {
    return this.comissoes.extrato(req.auth!.tenantId, req.auth!.userId, from, to);
  }

  @Get('regras')
  @ApiOkResponse({ type: [RegraDto] })
  regras(@Req() req: Request): Promise<RegraDto[]> {
    return this.comissoes.listRegras(req.auth!.tenantId);
  }

  @Post('regras')
  @ApiCreatedResponse({ type: RegraDto })
  upsertRegra(@Req() req: Request, @Body() dto: CreateRegraDto): Promise<RegraDto> {
    return this.comissoes.upsertRegra(req.auth!.tenantId, dto);
  }

  @Delete('regras/:id')
  @ApiOkResponse({ schema: { properties: { ok: { type: 'boolean' } } } })
  removeRegra(@Req() req: Request, @Param('id') id: string): Promise<{ ok: boolean }> {
    return this.comissoes.removeRegra(req.auth!.tenantId, id);
  }
}
