import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [ClientesController],
  providers: [ClientesService, JwtAuthGuard],
})
export class ClientesModule {}
