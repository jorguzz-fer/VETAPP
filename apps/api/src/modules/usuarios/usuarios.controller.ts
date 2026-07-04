import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { UsuariosService } from './usuarios.service';
import {
  AtualizarUsuarioDto,
  CriarUsuarioDto,
  CriarUsuarioResultDto,
  OkDto,
  SenhaTemporariaDto,
  UsuarioDto,
} from './usuarios.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';
import { AuditService } from '../audit/audit.service';

// Gestão de usuários e acessos (doc 07). Restrito a admin. Ordem dos guards
// importa: JwtAuthGuard popula req.auth antes do RolesGuard.
@ApiTags('usuarios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('usuarios')
export class UsuariosController {
  constructor(
    private readonly usuarios: UsuariosService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOkResponse({ type: [UsuarioDto] })
  list(@Req() req: Request): Promise<UsuarioDto[]> {
    return this.usuarios.list(req.auth!.tenantId);
  }

  @Post()
  @ApiCreatedResponse({ type: CriarUsuarioResultDto })
  async criar(@Req() req: Request, @Body() dto: CriarUsuarioDto): Promise<CriarUsuarioResultDto> {
    const result = await this.usuarios.criar(req.auth!.tenantId, dto);
    await this.audit.registrar(req.auth!.tenantId, {
      userId: req.auth!.userId,
      acao: 'usuario.criar',
      entidade: 'usuario',
      entidadeId: result.userId,
      resumo: `${result.senhaTemporaria ? 'Criou' : 'Vinculou'} ${result.email} como ${result.role}`,
      detalhe: { email: result.email, role: result.role, vinculado: result.senhaTemporaria === null },
      ip: req.ip ?? null,
    });
    return result;
  }

  @Patch(':userId')
  @ApiOkResponse({ type: UsuarioDto })
  async atualizar(
    @Req() req: Request,
    @Param('userId') userId: string,
    @Body() dto: AtualizarUsuarioDto,
  ): Promise<UsuarioDto> {
    const result = await this.usuarios.atualizar(req.auth!.tenantId, req.auth!.userId, userId, dto);
    await this.audit.registrar(req.auth!.tenantId, {
      userId: req.auth!.userId,
      acao: 'usuario.atualizar',
      entidade: 'usuario',
      entidadeId: userId,
      resumo: `Atualizou ${result.email}` +
        (dto.role !== undefined ? ` → papel ${dto.role}` : '') +
        (dto.status !== undefined ? ` → ${dto.status === 'disabled' ? 'desativado' : 'ativo'}` : ''),
      detalhe: { role: dto.role ?? null, status: dto.status ?? null },
      ip: req.ip ?? null,
    });
    return result;
  }

  @Post(':userId/reset-senha')
  @ApiOkResponse({ type: SenhaTemporariaDto })
  async resetSenha(@Req() req: Request, @Param('userId') userId: string): Promise<SenhaTemporariaDto> {
    const result = await this.usuarios.resetSenha(req.auth!.tenantId, userId);
    await this.audit.registrar(req.auth!.tenantId, {
      userId: req.auth!.userId,
      acao: 'usuario.reset_senha',
      entidade: 'usuario',
      entidadeId: userId,
      resumo: 'Gerou nova senha temporária',
      ip: req.ip ?? null,
    });
    return result;
  }

  @Delete(':userId')
  @ApiOkResponse({ type: OkDto })
  async remover(@Req() req: Request, @Param('userId') userId: string): Promise<OkDto> {
    const result = await this.usuarios.remover(req.auth!.tenantId, req.auth!.userId, userId);
    await this.audit.registrar(req.auth!.tenantId, {
      userId: req.auth!.userId,
      acao: 'usuario.remover',
      entidade: 'usuario',
      entidadeId: userId,
      resumo: 'Removeu o acesso do usuário à clínica',
      ip: req.ip ?? null,
    });
    return result;
  }
}
