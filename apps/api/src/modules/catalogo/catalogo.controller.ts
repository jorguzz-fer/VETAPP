import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CatalogoService } from './catalogo.service';
import { CreateItemDto, ItemCatalogoDto, UpdateItemDto } from './catalogo.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('catalogo')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('catalogo')
export class CatalogoController {
  constructor(private readonly catalogo: CatalogoService) {}

  @Get()
  @ApiQuery({ name: 'search', required: false, description: 'Nome ou código' })
  @ApiQuery({ name: 'tipo', required: false })
  @ApiQuery({ name: 'incluirInativos', required: false, type: Boolean })
  @ApiOkResponse({ type: [ItemCatalogoDto] })
  list(
    @Req() req: Request,
    @Query('search') search?: string,
    @Query('tipo') tipo?: string,
    @Query('incluirInativos') incluirInativos?: string,
  ): Promise<ItemCatalogoDto[]> {
    return this.catalogo.list(req.auth!.tenantId, search, tipo, incluirInativos === 'true');
  }

  @Roles('admin', 'gestor')
  @Post()
  @ApiCreatedResponse({ type: ItemCatalogoDto })
  create(@Req() req: Request, @Body() dto: CreateItemDto): Promise<ItemCatalogoDto> {
    return this.catalogo.create(req.auth!.tenantId, dto);
  }

  @Roles('admin', 'gestor')
  @Patch(':id')
  @ApiOkResponse({ type: ItemCatalogoDto })
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateItemDto): Promise<ItemCatalogoDto> {
    return this.catalogo.update(req.auth!.tenantId, id, dto);
  }

  @Roles('admin', 'gestor')
  @Delete(':id')
  @ApiOkResponse({ schema: { properties: { ok: { type: 'boolean' } } } })
  remove(@Req() req: Request, @Param('id') id: string): Promise<{ ok: boolean }> {
    return this.catalogo.remove(req.auth!.tenantId, id);
  }
}
