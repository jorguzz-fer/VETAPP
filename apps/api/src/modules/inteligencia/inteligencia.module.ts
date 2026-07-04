import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { InteligenciaController } from './inteligencia.controller';
import { InteligenciaService } from './inteligencia.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [InteligenciaController],
  providers: [InteligenciaService, JwtAuthGuard],
})
export class InteligenciaModule {}
