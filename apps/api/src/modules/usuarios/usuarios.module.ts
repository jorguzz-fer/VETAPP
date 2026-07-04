import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

// Gestão de usuários e acessos (doc 07). Admin-only.
@Module({
  imports: [JwtModule.register({})],
  controllers: [UsuariosController],
  providers: [UsuariosService, JwtAuthGuard, RolesGuard],
})
export class UsuariosModule {}
