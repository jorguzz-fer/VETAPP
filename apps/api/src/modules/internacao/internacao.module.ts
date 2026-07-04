import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { InternacaoController } from './internacao.controller';
import { InternacaoService } from './internacao.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FinanceiroModule } from '../financeiro/financeiro.module';

@Module({
  imports: [JwtModule.register({}), FinanceiroModule],
  controllers: [InternacaoController],
  providers: [InternacaoService, JwtAuthGuard],
})
export class InternacaoModule {}
