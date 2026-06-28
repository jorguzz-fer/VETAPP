import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ClientesService } from './clientes.service';
import {
  AnimalDto,
  CreateAnimalDto,
  CreateResponsavelDto,
  ListResponsaveisDto,
  OkDto,
  ResponsavelComAnimaisDto,
  ResponsavelDto,
  UpdateAnimalDto,
  UpdateResponsavelDto,
} from './clientes.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

// Tenant vem do contexto autenticado (req.auth), nunca do cliente.
@ApiTags('clientes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ClientesController {
  constructor(private readonly clientes: ClientesService) {}

  @Get('clientes')
  @ApiQuery({ name: 'search', required: false, description: 'Nome ou telefone' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiOkResponse({ type: ListResponsaveisDto })
  list(
    @Req() req: Request,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<ListResponsaveisDto> {
    return this.clientes.listResponsaveis(req.auth!.tenantId, {
      search,
      page: Math.max(1, Number(page) || 1),
      pageSize: Math.min(100, Math.max(1, Number(pageSize) || 20)),
    });
  }

  @Post('clientes')
  @ApiCreatedResponse({ type: ResponsavelDto })
  create(@Req() req: Request, @Body() dto: CreateResponsavelDto): Promise<ResponsavelDto> {
    return this.clientes.createResponsavel(req.auth!.tenantId, dto);
  }

  @Get('clientes/:id')
  @ApiOkResponse({ type: ResponsavelComAnimaisDto })
  ficha(@Req() req: Request, @Param('id') id: string): Promise<ResponsavelComAnimaisDto> {
    return this.clientes.getFicha(req.auth!.tenantId, id);
  }

  @Patch('clientes/:id')
  @ApiOkResponse({ type: ResponsavelDto })
  updateCliente(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateResponsavelDto): Promise<ResponsavelDto> {
    return this.clientes.updateResponsavel(req.auth!.tenantId, id, dto);
  }

  @Delete('clientes/:id')
  @ApiOkResponse({ type: OkDto })
  removeCliente(@Req() req: Request, @Param('id') id: string): Promise<OkDto> {
    return this.clientes.deleteResponsavel(req.auth!.tenantId, id);
  }

  @Post('clientes/:id/animais')
  @ApiCreatedResponse({ type: AnimalDto })
  addAnimal(@Req() req: Request, @Param('id') id: string, @Body() dto: CreateAnimalDto): Promise<AnimalDto> {
    return this.clientes.createAnimal(req.auth!.tenantId, id, dto);
  }

  @Get('animais/:id')
  @ApiOkResponse({ type: AnimalDto })
  animal(@Req() req: Request, @Param('id') id: string): Promise<AnimalDto> {
    return this.clientes.getAnimal(req.auth!.tenantId, id);
  }

  @Patch('animais/:id')
  @ApiOkResponse({ type: AnimalDto })
  updateAnimal(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateAnimalDto): Promise<AnimalDto> {
    return this.clientes.updateAnimal(req.auth!.tenantId, id, dto);
  }

  @Delete('animais/:id')
  @ApiOkResponse({ type: OkDto })
  removeAnimal(@Req() req: Request, @Param('id') id: string): Promise<OkDto> {
    return this.clientes.deleteAnimal(req.auth!.tenantId, id);
  }
}
