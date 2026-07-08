import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MensageriaService } from './mensageria.service';
import { MensageriaController } from './mensageria.controller';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

// Mensageria / CRM (doc 17). Exporta o service para outros módulos usarem (ex.:
// lembretes de vacina, notificação de chegada) nas próximas fatias.
@Module({
  imports: [JwtModule.register({})],
  providers: [MensageriaService, JwtAuthGuard],
  controllers: [MensageriaController],
  exports: [MensageriaService],
})
export class MensageriaModule {}
