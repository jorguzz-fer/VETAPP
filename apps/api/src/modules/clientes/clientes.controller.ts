import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ClientesService } from './clientes.service';
import {
  AnimalDto,
  CreateAnimalDto,
  CreateResponsavelDto,
  ResponsavelComAnimaisDto,
  ResponsavelDto,
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
  @ApiQuery({ name: 'search', required: false })
  @ApiOkResponse({ type: [ResponsavelDto] })
  list(@Req() req: Request, @Query('search') search?: string): Promise<ResponsavelDto[]> {
    return this.clientes.listResponsaveis(req.auth!.tenantId, search);
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
}
