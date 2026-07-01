import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { FinanceiroService } from './financeiro.service';
import { FaturaResumoDto, OkDto } from './financeiro.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('financeiro')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('faturas')
export class FinanceiroController {
  constructor(private readonly financeiro: FinanceiroService) {}

  @Get()
  @ApiQuery({ name: 'status', required: false, enum: ['aberta', 'paga', 'cancelada'] })
  @ApiOkResponse({ type: [FaturaResumoDto] })
  list(@Req() req: Request, @Query('status') status?: string): Promise<FaturaResumoDto[]> {
    return this.financeiro.listFaturas(req.auth!.tenantId, status);
  }

  @Post(':id/pagar')
  @ApiOkResponse({ type: OkDto })
  pagar(@Req() req: Request, @Param('id') id: string): Promise<OkDto> {
    return this.financeiro.pagar(req.auth!.tenantId, id);
  }
}
