import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EstoqueController } from './estoque.controller';
import { EstoqueService } from './estoque.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [EstoqueController],
  providers: [EstoqueService, JwtAuthGuard],
})
export class EstoqueModule {}
