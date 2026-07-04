import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { InteligenciaService } from './inteligencia.service';
import { ProdutividadeDto } from './inteligencia.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('inteligencia')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inteligencia')
export class InteligenciaController {
  constructor(private readonly inteligencia: InteligenciaService) {}

  @Get('produtividade')
  @ApiQuery({ name: 'from', required: false, description: 'ISO 8601' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO 8601' })
  @ApiOkResponse({ type: [ProdutividadeDto] })
  produtividade(
    @Req() req: Request,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<ProdutividadeDto[]> {
    return this.inteligencia.produtividade(req.auth!.tenantId, from, to);
  }
}
