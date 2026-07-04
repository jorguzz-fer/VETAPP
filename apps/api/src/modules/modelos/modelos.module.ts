import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ModelosController } from './modelos.controller';
import { ModelosService } from './modelos.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

// Modelos de receita/documento (doc 05 §8.10/§8.12).
@Module({
  imports: [JwtModule.register({})],
  controllers: [ModelosController],
  providers: [ModelosService, JwtAuthGuard],
})
export class ModelosModule {}
