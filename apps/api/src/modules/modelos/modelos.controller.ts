import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ModelosService } from './modelos.service';
import {
  CreateModeloDto,
  GerarModeloDto,
  ModeloDto,
  ModeloGeradoDto,
  UpdateModeloDto,
} from './modelos.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

// Modelos de receita/documento (doc 05 §8). Tenant sempre de req.auth.
@ApiTags('modelos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('modelos')
export class ModelosController {
  constructor(private readonly modelos: ModelosService) {}

  @Get()
  @ApiQuery({ name: 'tipo', required: false, enum: ['receita', 'documento'] })
  @ApiOkResponse({ type: [ModeloDto] })
  list(@Req() req: Request, @Query('tipo') tipo?: string): Promise<ModeloDto[]> {
    return this.modelos.list(req.auth!.tenantId, tipo);
  }

  @Post()
  @ApiCreatedResponse({ type: ModeloDto })
  create(@Req() req: Request, @Body() dto: CreateModeloDto): Promise<ModeloDto> {
    return this.modelos.create(req.auth!.tenantId, dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: ModeloDto })
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateModeloDto): Promise<ModeloDto> {
    return this.modelos.update(req.auth!.tenantId, id, dto);
  }

  @Delete(':id')
  @ApiOkResponse({ schema: { properties: { ok: { type: 'boolean' } } } })
  remove(@Req() req: Request, @Param('id') id: string): Promise<{ ok: boolean }> {
    return this.modelos.remove(req.auth!.tenantId, id);
  }

  @Post(':id/gerar')
  @ApiOkResponse({ type: ModeloGeradoDto })
  gerar(@Req() req: Request, @Param('id') id: string, @Body() dto: GerarModeloDto): Promise<ModeloGeradoDto> {
    return this.modelos.gerar(req.auth!.tenantId, id, dto.animalId);
  }
}
