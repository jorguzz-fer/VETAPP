import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { InternacaoService } from './internacao.service';
import {
  AdmitirDto,
  AltaDto,
  CriarItemListaDto,
  ExecucaoDto,
  ExecutarResultDto,
  InternacaoDetalheDto,
  InternacaoResumoDto,
  ItemListaDto,
  PrescreverDto,
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

  @Get(':id')
  @ApiOkResponse({ type: InternacaoDetalheDto })
  detalhe(@Req() req: Request, @Param('id') id: string): Promise<InternacaoDetalheDto> {
    return this.internacao.detalhe(req.auth!.tenantId, id);
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
