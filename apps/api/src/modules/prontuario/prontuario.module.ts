import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ProntuarioController } from './prontuario.controller';
import { ProntuarioService } from './prontuario.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [ProntuarioController],
  providers: [ProntuarioService, JwtAuthGuard],
})
export class ProntuarioModule {}
