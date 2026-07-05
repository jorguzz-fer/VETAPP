import { Global, Module } from '@nestjs/common';
import { AssinaturasService } from './assinaturas.service';
import { PlanosService } from './planos.service';

// Assinaturas do SaaS (doc 15). @Global: o AuthService (gestão) usa avaliarAcesso no
// login-enforcement e o back-office da plataforma usa o CRUD — sem reimportar.
@Global()
@Module({
  providers: [AssinaturasService, PlanosService],
  exports: [AssinaturasService, PlanosService],
})
export class AssinaturasModule {}
