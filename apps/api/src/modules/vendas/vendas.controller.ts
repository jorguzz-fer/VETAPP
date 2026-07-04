import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { VendasService } from './vendas.service';
import {
  AddOrcamentoItemDto,
  ConverterResultDto,
  CreateOrcamentoDto,
  OrcamentoDetalheDto,
  OrcamentoItemDto,
  OrcamentoResumoDto,
  UpdateOrcamentoStatusDto,
} from './vendas.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('vendas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orcamentos')
export class VendasController {
  constructor(private readonly vendas: VendasService) {}

  @Get()
  @ApiQuery({ name: 'status', required: false, enum: ['aberto', 'aprovado', 'recusado', 'convertido'] })
  @ApiQuery({ name: 'responsavelId', required: false })
  @ApiOkResponse({ type: [OrcamentoResumoDto] })
  list(
    @Req() req: Request,
    @Query('status') status?: string,
    @Query('responsavelId') responsavelId?: string,
  ): Promise<OrcamentoResumoDto[]> {
    return this.vendas.list(req.auth!.tenantId, status, responsavelId);
  }

  @Post()
  @ApiCreatedResponse({ type: OrcamentoResumoDto })
  create(@Req() req: Request, @Body() dto: CreateOrcamentoDto): Promise<OrcamentoResumoDto> {
    return this.vendas.create(req.auth!.tenantId, dto);
  }

  @Get(':id')
  @ApiOkResponse({ type: OrcamentoDetalheDto })
  detalhe(@Req() req: Request, @Param('id') id: string): Promise<OrcamentoDetalheDto> {
    return this.vendas.detalhe(req.auth!.tenantId, id);
  }

  @Post(':id/itens')
  @ApiCreatedResponse({ type: OrcamentoItemDto })
  addItem(@Req() req: Request, @Param('id') id: string, @Body() dto: AddOrcamentoItemDto): Promise<OrcamentoItemDto> {
    return this.vendas.addItem(req.auth!.tenantId, id, dto);
  }

  @Delete(':id/itens/:linhaId')
  @ApiOkResponse({ schema: { properties: { ok: { type: 'boolean' } } } })
  removeItem(@Req() req: Request, @Param('id') id: string, @Param('linhaId') linhaId: string): Promise<{ ok: boolean }> {
    return this.vendas.removeItem(req.auth!.tenantId, id, linhaId);
  }

  @Patch(':id/status')
  @ApiOkResponse({ type: OrcamentoResumoDto })
  updateStatus(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateOrcamentoStatusDto,
  ): Promise<OrcamentoResumoDto> {
    return this.vendas.updateStatus(req.auth!.tenantId, id, dto.status);
  }

  @Post(':id/converter')
  @ApiOkResponse({ type: ConverterResultDto })
  converter(@Req() req: Request, @Param('id') id: string): Promise<ConverterResultDto> {
    return this.vendas.converter(req.auth!.tenantId, id);
  }
}
