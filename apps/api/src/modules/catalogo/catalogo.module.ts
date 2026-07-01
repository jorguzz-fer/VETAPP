import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CatalogoController } from './catalogo.controller';
import { CatalogoService } from './catalogo.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [CatalogoController],
  providers: [CatalogoService, JwtAuthGuard],
})
export class CatalogoModule {}
