import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { DashboardService } from './dashboard.service';
import { DashboardDto } from './dashboard.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'gestor', 'financeiro')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @ApiOkResponse({ type: DashboardDto })
  resumo(@Req() req: Request): Promise<DashboardDto> {
    return this.dashboard.resumo(req.auth!.tenantId, req.auth!.userId);
  }
}
