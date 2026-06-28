import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AgendaController } from './agenda.controller';
import { AgendaService } from './agenda.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AgendaController],
  providers: [AgendaService, JwtAuthGuard],
})
export class AgendaModule {}
