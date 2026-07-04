import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { InternacaoService } from './internacao.service';
import {
  AdmitirDto,
  AltaDto,
  AplicarModeloDto,
  CriarItemListaDto,
  CriarModeloPrescricaoDto,
  ExecucaoDto,
  ExecutarResultDto,
  InternacaoDetalheDto,
  InternacaoResumoDto,
  ItemListaDto,
  ModeloPrescricaoDto,
  ParametroDto,
  PrescreverDto,
  RegistrarParametroDto,
} from './internacao.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('internacao')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('internacoes')
export class InternacaoController {
  constructor(private readonly internacao: InternacaoService) {}

  @Get()
  @ApiQuery({ name: 'status', required: false, enum: ['internado', 'alta'] })
  @ApiOkResponse({ type: [InternacaoResumoDto] })
  list(@Req() req: Request, @Query('status') status?: string): Promise<InternacaoResumoDto[]> {
    return this.internacao.list(req.auth!.tenantId, status);
  }

  @Post()
  @ApiCreatedResponse({ type: InternacaoResumoDto })
  admitir(@Req() req: Request, @Body() dto: AdmitirDto): Promise<InternacaoResumoDto> {
    return this.internacao.admitir(req.auth!.tenantId, dto);
  }

  // Listas gerenciadas da admissão. DECLARAR ANTES de :id (senão o param captura
  // "motivos"/"boxes").
  @Get('motivos')
  @ApiOkResponse({ type: [ItemListaDto] })
  listMotivos(@Req() req: Request): Promise<ItemListaDto[]> {
    return this.internacao.listMotivos(req.auth!.tenantId);
  }

  @Post('motivos')
  @ApiCreatedResponse({ type: ItemListaDto })
  criarMotivo(@Req() req: Request, @Body() dto: CriarItemListaDto): Promise<ItemListaDto> {
    return this.internacao.criarMotivo(req.auth!.tenantId, dto);
  }

  @Get('boxes')
  @ApiOkResponse({ type: [ItemListaDto] })
  listBoxes(@Req() req: Request): Promise<ItemListaDto[]> {
    return this.internacao.listBoxes(req.auth!.tenantId);
  }

  @Post('boxes')
  @ApiCreatedResponse({ type: ItemListaDto })
  criarBox(@Req() req: Request, @Body() dto: CriarItemListaDto): Promise<ItemListaDto> {
    return this.internacao.criarBox(req.auth!.tenantId, dto);
  }

  @Patch('motivos/:id')
  @ApiOkResponse({ type: ItemListaDto })
  renomearMotivo(@Req() req: Request, @Param('id') id: string, @Body() dto: CriarItemListaDto): Promise<ItemListaDto> {
    return this.internacao.renomearMotivo(req.auth!.tenantId, id, dto.nome);
  }

  @Delete('motivos/:id')
  @ApiOkResponse({ schema: { properties: { ok: { type: 'boolean' } } } })
  removerMotivo(@Req() req: Request, @Param('id') id: string): Promise<{ ok: boolean }> {
    return this.internacao.removerMotivo(req.auth!.tenantId, id);
  }

  @Patch('boxes/:id')
  @ApiOkResponse({ type: ItemListaDto })
  renomearBox(@Req() req: Request, @Param('id') id: string, @Body() dto: CriarItemListaDto): Promise<ItemListaDto> {
    return this.internacao.renomearBox(req.auth!.tenantId, id, dto.nome);
  }

  @Delete('boxes/:id')
  @ApiOkResponse({ schema: { properties: { ok: { type: 'boolean' } } } })
  removerBox(@Req() req: Request, @Param('id') id: string): Promise<{ ok: boolean }> {
    return this.internacao.removerBox(req.auth!.tenantId, id);
  }

  // Modelos de prescrição (doc 05 §9.6). DECLARAR ANTES de :id.
  @Get('modelos-prescricao')
  @ApiOkResponse({ type: [ModeloPrescricaoDto] })
  listModelosPrescricao(@Req() req: Request): Promise<ModeloPrescricaoDto[]> {
    return this.internacao.listModelosPrescricao(req.auth!.tenantId);
  }

  @Post('modelos-prescricao')
  @ApiCreatedResponse({ type: ModeloPrescricaoDto })
  criarModeloPrescricao(@Req() req: Request, @Body() dto: CriarModeloPrescricaoDto): Promise<ModeloPrescricaoDto> {
    return this.internacao.criarModeloPrescricao(req.auth!.tenantId, dto);
  }

  @Delete('modelos-prescricao/:id')
  @ApiOkResponse({ schema: { properties: { ok: { type: 'boolean' } } } })
  removerModeloPrescricao(@Req() req: Request, @Param('id') id: string): Promise<{ ok: boolean }> {
    return this.internacao.removerModeloPrescricao(req.auth!.tenantId, id);
  }

  @Get(':id')
  @ApiOkResponse({ type: InternacaoDetalheDto })
  detalhe(@Req() req: Request, @Param('id') id: string): Promise<InternacaoDetalheDto> {
    return this.internacao.detalhe(req.auth!.tenantId, id);
  }

  @Post(':id/aplicar-modelo')
  @ApiOkResponse({ type: [ExecucaoDto] })
  aplicarModelo(@Req() req: Request, @Param('id') id: string, @Body() dto: AplicarModeloDto): Promise<ExecucaoDto[]> {
    return this.internacao.aplicarModelo(req.auth!.tenantId, id, dto.modeloId);
  }

  @Get(':id/parametros')
  @ApiOkResponse({ type: [ParametroDto] })
  listParametros(@Req() req: Request, @Param('id') id: string): Promise<ParametroDto[]> {
    return this.internacao.listParametros(req.auth!.tenantId, id);
  }

  @Post(':id/parametros')
  @ApiCreatedResponse({ type: ParametroDto })
  registrarParametro(@Req() req: Request, @Param('id') id: string, @Body() dto: RegistrarParametroDto): Promise<ParametroDto> {
    return this.internacao.registrarParametro(req.auth!.tenantId, id, dto);
  }

  @Post(':id/execucoes')
  @ApiCreatedResponse({ type: ExecucaoDto })
  prescrever(@Req() req: Request, @Param('id') id: string, @Body() dto: PrescreverDto): Promise<ExecucaoDto> {
    return this.internacao.prescrever(req.auth!.tenantId, id, dto);
  }

  @Post(':id/execucoes/:execId/executar')
  @ApiOkResponse({ type: ExecutarResultDto })
  executar(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('execId') execId: string,
  ): Promise<ExecutarResultDto> {
    return this.internacao.executar(req.auth!.tenantId, id, execId, req.auth!.userId);
  }

  @Post(':id/alta')
  @ApiOkResponse({ type: InternacaoResumoDto })
  alta(@Req() req: Request, @Param('id') id: string, @Body() dto: AltaDto): Promise<InternacaoResumoDto> {
    return this.internacao.alta(req.auth!.tenantId, id, dto);
  }
}
