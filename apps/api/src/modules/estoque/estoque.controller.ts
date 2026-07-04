import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { EstoqueService } from './estoque.service';
import {
  CreateMovimentoDto,
  MovimentoDto,
  MovimentoResultDto,
  SaldoItemDto,
  SetMinimoDto,
  VencimentoDto,
} from './estoque.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('estoque')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('estoque')
export class EstoqueController {
  constructor(private readonly estoque: EstoqueService) {}

  @Get()
  @ApiQuery({ name: 'search', required: false, description: 'Nome ou código' })
  @ApiQuery({ name: 'apenasBaixo', required: false, type: Boolean, description: 'Só itens abaixo do mínimo' })
  @ApiOkResponse({ type: [SaldoItemDto] })
  saldos(
    @Req() req: Request,
    @Query('search') search?: string,
    @Query('apenasBaixo') apenasBaixo?: string,
  ): Promise<SaldoItemDto[]> {
    return this.estoque.listSaldos(req.auth!.tenantId, search, apenasBaixo === 'true');
  }

  // Vencimentos próximos (lotes a vencer). Rota estática ANTES da param `:itemId`.
  @Get('vencimentos')
  @ApiQuery({ name: 'dias', required: false, type: Number, description: 'Janela em dias (default 90)' })
  @ApiOkResponse({ type: [VencimentoDto] })
  vencimentos(@Req() req: Request, @Query('dias') dias?: string): Promise<VencimentoDto[]> {
    return this.estoque.listVencimentos(req.auth!.tenantId, dias ? Number(dias) : undefined);
  }

  @Get(':itemId/movimentos')
  @ApiOkResponse({ type: [MovimentoDto] })
  movimentos(@Req() req: Request, @Param('itemId') itemId: string): Promise<MovimentoDto[]> {
    return this.estoque.listMovimentos(req.auth!.tenantId, itemId);
  }

  @Post('movimentos')
  @ApiCreatedResponse({ type: MovimentoResultDto })
  registrar(@Req() req: Request, @Body() dto: CreateMovimentoDto): Promise<MovimentoResultDto> {
    return this.estoque.registrar(req.auth!.tenantId, dto);
  }

  @Patch(':itemId/minimo')
  @ApiOkResponse({ type: SaldoItemDto })
  minimo(@Req() req: Request, @Param('itemId') itemId: string, @Body() dto: SetMinimoDto): Promise<SaldoItemDto> {
    return this.estoque.definirMinimo(req.auth!.tenantId, itemId, dto.estoqueMinimo);
  }
}
