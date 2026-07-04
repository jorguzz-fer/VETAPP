import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { VendasController } from './vendas.controller';
import { VendasService } from './vendas.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FinanceiroModule } from '../financeiro/financeiro.module';

@Module({
  imports: [JwtModule.register({}), FinanceiroModule],
  controllers: [VendasController],
  providers: [VendasService, JwtAuthGuard],
})
export class VendasModule {}
