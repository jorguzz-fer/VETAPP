import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { FinanceiroController } from './financeiro.controller';
import { FinanceiroService } from './financeiro.service';
import { FaturamentoService } from './faturamento.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [FinanceiroController],
  providers: [FinanceiroService, FaturamentoService, JwtAuthGuard],
  exports: [FaturamentoService],
})
export class FinanceiroModule {}
