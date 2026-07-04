import { Body, Controller, Delete, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { BrandingService } from './branding.service';
import { BrandingDto, ConfirmLogoDto, SignLogoDto, SignUploadResponseDto } from './branding.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';
import { AuditService } from '../audit/audit.service';

// Branding do tenant (logo da clínica). Leitura: qualquer membro autenticado (para
// renderizar o logo no app/documentos). Escrita: só admin. A ordem dos guards
// importa — o JwtAuthGuard popula req.auth ANTES do RolesGuard lê-lo.
@ApiTags('branding')
@ApiBearerAuth()
@Controller('branding')
export class BrandingController {
  constructor(
    private readonly branding: BrandingService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ type: BrandingDto })
  get(@Req() req: Request): Promise<BrandingDto> {
    return this.branding.get(req.auth!.tenantId);
  }

  @Post('logo/sign-upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiCreatedResponse({ type: SignUploadResponseDto })
  signLogo(@Req() req: Request, @Body() dto: SignLogoDto): Promise<SignUploadResponseDto> {
    return this.branding.signLogoUpload(req.auth!.tenantId, dto.contentType);
  }

  @Post('logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(200)
  @ApiOkResponse({ type: BrandingDto })
  async confirmLogo(@Req() req: Request, @Body() dto: ConfirmLogoDto): Promise<BrandingDto> {
    const result = await this.branding.confirmLogo(req.auth!.tenantId, dto.key);
    await this.audit.registrar(req.auth!.tenantId, {
      userId: req.auth!.userId,
      acao: 'branding.logo_atualizar',
      entidade: 'branding',
      resumo: 'Atualizou o logo da clínica',
      ip: req.ip ?? null,
    });
    return result;
  }

  @Delete('logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOkResponse({ type: BrandingDto })
  async removeLogo(@Req() req: Request): Promise<BrandingDto> {
    const result = await this.branding.removeLogo(req.auth!.tenantId);
    await this.audit.registrar(req.auth!.tenantId, {
      userId: req.auth!.userId,
      acao: 'branding.logo_remover',
      entidade: 'branding',
      resumo: 'Removeu o logo da clínica',
      ip: req.ip ?? null,
    });
    return result;
  }
}
