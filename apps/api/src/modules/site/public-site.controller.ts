import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SiteService } from './site.service';
import { RateLimiter } from './rate-limiter';
import { CreateSolicitacaoDto, OkDto, PublicSiteDto } from './site.dto';

// Superfície PÚBLICA do site (doc 13 §4). SEM auth — mas nenhum dado de clínica é
// exposto: só o conteúdo publicado (por slug) e a criação de uma SOLICITAÇÃO de
// agendamento (a clínica confirma; nada grava direto na agenda). Rate-limited +
// honeypot. É a única rota anônima de escrita do sistema.
@ApiTags('public-site')
@Controller('public/clinica')
export class PublicSiteController {
  constructor(
    private readonly site: SiteService,
    private readonly rateLimiter: RateLimiter,
  ) {}

  @Get(':slug')
  @ApiOkResponse({ type: PublicSiteDto })
  get(@Param('slug') slug: string): Promise<PublicSiteDto> {
    return this.site.getPublic(slug);
  }

  @Post(':slug/agendamento')
  @HttpCode(200)
  @ApiOkResponse({ type: OkDto })
  async solicitar(
    @Req() req: Request,
    @Param('slug') slug: string,
    @Body() dto: CreateSolicitacaoDto,
  ): Promise<OkDto> {
    // Rate limit por IP+slug: no máx. 5 solicitações a cada 10 min.
    const ip = req.ip ?? 'desconhecido';
    if (!this.rateLimiter.allow(`${ip}:${slug}`, 5, 10 * 60 * 1000)) {
      throw new HttpException('Muitas solicitações. Tente novamente mais tarde.', HttpStatus.TOO_MANY_REQUESTS);
    }
    // Resposta sempre ok (mesmo no honeypot) — não vaza se caiu no filtro anti-spam.
    await this.site.criarSolicitacao(slug, dto);
    return { ok: true };
  }
}
