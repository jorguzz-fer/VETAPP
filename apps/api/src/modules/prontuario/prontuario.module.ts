import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ProntuarioController } from './prontuario.controller';
import { ProntuarioService } from './prontuario.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FinanceiroModule } from '../financeiro/financeiro.module';

@Module({
  imports: [JwtModule.register({}), FinanceiroModule],
  controllers: [ProntuarioController],
  providers: [ProntuarioService, JwtAuthGuard],
})
export class ProntuarioModule {}
