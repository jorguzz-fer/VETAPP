import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ComissoesController } from './comissoes.controller';
import { ComissoesService } from './comissoes.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [ComissoesController],
  providers: [ComissoesService, JwtAuthGuard],
  exports: [ComissoesService],
})
export class ComissoesModule {}
