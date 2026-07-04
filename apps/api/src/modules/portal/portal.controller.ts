import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PortalAuthService } from './portal-auth.service';
import { PortalService } from './portal.service';
import { TutorGuard } from './tutor.guard';
import {
  OkDto,
  PortalAcceptInviteDto,
  PortalAgendamentoDto,
  PortalFaturaDetalheDto,
  PortalFaturaResumoDto,
  PortalInvitePreviewDto,
  PortalLoginDto,
  PortalLogoutDto,
  PortalMeDto,
  PortalPetDetalheDto,
  PortalPetDto,
  PortalRefreshDto,
  PortalTokensDto,
} from './portal.dto';

// Portal do tutor (doc 13 §5) — superfície SEPARADA da gestão. Rotas públicas de
// auth + rotas protegidas pelo TutorGuard (scope 'tutor'). Nenhuma rota da gestão.
@ApiTags('portal')
@Controller('portal')
export class PortalController {
  constructor(
    private readonly auth: PortalAuthService,
    private readonly portal: PortalService,
  ) {}

  // ───────── Auth do tutor (público) ─────────

  @Get('convite/:token')
  @ApiOkResponse({ type: PortalInvitePreviewDto })
  invitePreview(@Param('token') token: string): Promise<PortalInvitePreviewDto> {
    return this.auth.invitePreview(token);
  }

  @Post('convite/aceitar')
  @HttpCode(200)
  @ApiOkResponse({ type: PortalTokensDto })
  aceitar(@Body() dto: PortalAcceptInviteDto): Promise<PortalTokensDto> {
    return this.auth.aceitarConvite(dto.token, dto.password);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOkResponse({ type: PortalTokensDto })
  login(@Body() dto: PortalLoginDto): Promise<PortalTokensDto> {
    return this.auth.login(dto.tenantId, dto.email, dto.password);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOkResponse({ type: PortalTokensDto })
  refresh(@Body() dto: PortalRefreshDto): Promise<PortalTokensDto> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOkResponse({ type: OkDto })
  logout(@Body() dto: PortalLogoutDto): Promise<OkDto> {
    // Revoga a family do refresh apresentado (stateful — doc 02 §2.2).
    return this.auth.logout(dto.refreshToken);
  }

  // ───────── Dados do tutor (protegido) ─────────

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(TutorGuard)
  @ApiOkResponse({ type: PortalMeDto })
  me(@Req() req: Request): Promise<PortalMeDto> {
    return this.auth.me(req.tutor!.tenantId, req.tutor!.responsavelId);
  }

  @Get('pets')
  @ApiBearerAuth()
  @UseGuards(TutorGuard)
  @ApiOkResponse({ type: [PortalPetDto] })
  pets(@Req() req: Request): Promise<PortalPetDto[]> {
    return this.portal.meusPets(req.tutor!.tenantId, req.tutor!.responsavelId);
  }

  @Get('pets/:id')
  @ApiBearerAuth()
  @UseGuards(TutorGuard)
  @ApiOkResponse({ type: PortalPetDetalheDto })
  pet(@Req() req: Request, @Param('id') id: string): Promise<PortalPetDetalheDto> {
    return this.portal.petDetalhe(req.tutor!.tenantId, req.tutor!.responsavelId, id);
  }

  @Get('agendamentos')
  @ApiBearerAuth()
  @UseGuards(TutorGuard)
  @ApiOkResponse({ type: [PortalAgendamentoDto] })
  agendamentos(@Req() req: Request): Promise<PortalAgendamentoDto[]> {
    return this.portal.meusAgendamentos(req.tutor!.tenantId, req.tutor!.responsavelId);
  }

  @Get('faturas')
  @ApiBearerAuth()
  @UseGuards(TutorGuard)
  @ApiOkResponse({ type: [PortalFaturaResumoDto] })
  faturas(@Req() req: Request): Promise<PortalFaturaResumoDto[]> {
    return this.portal.minhasFaturas(req.tutor!.tenantId, req.tutor!.responsavelId);
  }

  @Get('faturas/:id')
  @ApiBearerAuth()
  @UseGuards(TutorGuard)
  @ApiOkResponse({ type: PortalFaturaDetalheDto })
  fatura(@Req() req: Request, @Param('id') id: string): Promise<PortalFaturaDetalheDto> {
    return this.portal.faturaDetalhe(req.tutor!.tenantId, req.tutor!.responsavelId, id);
  }
}
