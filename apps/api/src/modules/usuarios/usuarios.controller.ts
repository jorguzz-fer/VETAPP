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

// Gestão de usuários e acessos (doc 07). Restrito a admin. Ordem dos guards
// importa: JwtAuthGuard popula req.auth antes do RolesGuard.
@ApiTags('usuarios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  @ApiOkResponse({ type: [UsuarioDto] })
  list(@Req() req: Request): Promise<UsuarioDto[]> {
    return this.usuarios.list(req.auth!.tenantId);
  }

  @Post()
  @ApiCreatedResponse({ type: CriarUsuarioResultDto })
  criar(@Req() req: Request, @Body() dto: CriarUsuarioDto): Promise<CriarUsuarioResultDto> {
    return this.usuarios.criar(req.auth!.tenantId, dto);
  }

  @Patch(':userId')
  @ApiOkResponse({ type: UsuarioDto })
  atualizar(@Req() req: Request, @Param('userId') userId: string, @Body() dto: AtualizarUsuarioDto): Promise<UsuarioDto> {
    return this.usuarios.atualizar(req.auth!.tenantId, req.auth!.userId, userId, dto);
  }

  @Post(':userId/reset-senha')
  @ApiOkResponse({ type: SenhaTemporariaDto })
  resetSenha(@Req() req: Request, @Param('userId') userId: string): Promise<SenhaTemporariaDto> {
    return this.usuarios.resetSenha(req.auth!.tenantId, userId);
  }

  @Delete(':userId')
  @ApiOkResponse({ type: OkDto })
  remover(@Req() req: Request, @Param('userId') userId: string): Promise<OkDto> {
    return this.usuarios.remover(req.auth!.tenantId, req.auth!.userId, userId);
  }
}
