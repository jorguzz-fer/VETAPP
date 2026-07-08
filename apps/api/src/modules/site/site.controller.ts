import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SiteService } from './site.service';
import {
  ConfirmLogoDto,
  ConverterResultDto,
  SignLogoDto,
  SignUploadResponseDto,
  SiteConfigDto,
  SolicitacaoDto,
  TriagemDto,
  UpdateSiteConfigDto,
} from './site.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';

// Gestão do site + triagem de solicitações (interno). Tenant sempre de req.auth.
// Restrito a admin/gestor (CMS e leads de agendamento). Ordem dos guards importa:
// o JwtAuthGuard popula req.auth ANTES do RolesGuard lê-lo.
@ApiTags('site')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'gestor')
@Controller('site')
export class SiteController {
  constructor(private readonly site: SiteService) {}

  @Get('config')
  @ApiOkResponse({ type: SiteConfigDto })
  getConfig(@Req() req: Request): Promise<SiteConfigDto> {
    return this.site.getConfig(req.auth!.tenantId);
  }

  @Put('config')
  @ApiOkResponse({ type: SiteConfigDto })
  updateConfig(@Req() req: Request, @Body() dto: UpdateSiteConfigDto): Promise<SiteConfigDto> {
    return this.site.updateConfig(req.auth!.tenantId, dto);
  }

  @Post('config/logo/sign-upload')
  @ApiCreatedResponse({ type: SignUploadResponseDto })
  signLogo(@Req() req: Request, @Body() dto: SignLogoDto): Promise<SignUploadResponseDto> {
    return this.site.signLogoUpload(req.auth!.tenantId, dto.contentType);
  }

  @Post('config/logo')
  @HttpCode(200)
  @ApiOkResponse({ type: SiteConfigDto })
  confirmLogo(@Req() req: Request, @Body() dto: ConfirmLogoDto): Promise<SiteConfigDto> {
    return this.site.confirmLogo(req.auth!.tenantId, dto.key);
  }

  @Get('solicitacoes')
  @ApiQuery({ name: 'status', required: false, enum: ['nova', 'confirmada', 'recusada'] })
  @ApiOkResponse({ type: [SolicitacaoDto] })
  listSolicitacoes(@Req() req: Request, @Query('status') status?: string): Promise<SolicitacaoDto[]> {
    return this.site.listSolicitacoes(req.auth!.tenantId, status);
  }

  @Post('solicitacoes/:id/confirmar')
  @HttpCode(200)
  @ApiOkResponse({ type: SolicitacaoDto })
  confirmar(@Req() req: Request, @Param('id') id: string, @Body() dto: TriagemDto): Promise<SolicitacaoDto> {
    return this.site.confirmar(req.auth!.tenantId, id, dto.observacao);
  }

  @Post('solicitacoes/:id/recusar')
  @HttpCode(200)
  @ApiOkResponse({ type: SolicitacaoDto })
  recusar(@Req() req: Request, @Param('id') id: string, @Body() dto: TriagemDto): Promise<SolicitacaoDto> {
    return this.site.recusar(req.auth!.tenantId, id, dto.observacao);
  }

  // Converte a solicitação em cliente/responsável de verdade (+ pet, se informado).
  @Post('solicitacoes/:id/converter')
  @HttpCode(200)
  @ApiOkResponse({ type: ConverterResultDto })
  converter(@Req() req: Request, @Param('id') id: string): Promise<ConverterResultDto> {
    return this.site.converter(req.auth!.tenantId, id);
  }
}
