import { Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PortalAuthService } from './portal-auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OkDto, PortalAcessoDto, PortalConviteResponseDto } from './portal.dto';

// Gestão do acesso ao portal PELA CLÍNICA (usuário interno). Protegido pelo
// JwtAuthGuard da gestão — tenant vem sempre de req.auth, nunca do cliente.
@ApiTags('portal-admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('clientes/:responsavelId/portal')
export class PortalAdminController {
  constructor(private readonly auth: PortalAuthService) {}

  @Get()
  @ApiOkResponse({ type: PortalAcessoDto })
  status(@Req() req: Request, @Param('responsavelId') responsavelId: string): Promise<PortalAcessoDto> {
    return this.auth.acessoStatus(req.auth!.tenantId, responsavelId);
  }

  @Post('convite')
  @HttpCode(200)
  @ApiOkResponse({ type: PortalConviteResponseDto })
  convite(@Req() req: Request, @Param('responsavelId') responsavelId: string): Promise<PortalConviteResponseDto> {
    return this.auth.criarConvite(req.auth!.tenantId, responsavelId);
  }

  @Post('revogar')
  @HttpCode(200)
  @ApiOkResponse({ type: OkDto })
  revogar(@Req() req: Request, @Param('responsavelId') responsavelId: string): Promise<OkDto> {
    return this.auth.revogarAcesso(req.auth!.tenantId, responsavelId);
  }
}
