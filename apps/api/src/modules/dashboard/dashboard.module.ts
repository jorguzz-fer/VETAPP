import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ComissoesModule } from '../comissoes/comissoes.module';

@Module({
  imports: [JwtModule.register({}), ComissoesModule],
  controllers: [DashboardController],
  providers: [DashboardService, JwtAuthGuard],
})
export class DashboardModule {}
