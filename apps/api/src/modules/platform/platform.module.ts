import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PlatformController } from './platform.controller';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformAuditService } from './platform-audit.service';
import { PlatformBootstrapService } from './platform-bootstrap.service';
import { PlatformTenantsService } from './platform-tenants.service';
import { PlatformGuard } from './platform.guard';

// Admin da Plataforma (SaaS back-office) — doc 15. Auth do super-admin (Stage 1) +
// gestão de clínicas/planos/assinaturas + KPIs (Stage 2). AssinaturasService/
// PlanosService vêm do AssinaturasModule (global). DatabaseService é global.
@Module({
  imports: [JwtModule.register({})],
  controllers: [PlatformController, PlatformAdminController],
  providers: [
    PlatformAuthService,
    PlatformAuditService,
    PlatformBootstrapService,
    PlatformTenantsService,
    PlatformGuard,
  ],
  exports: [PlatformAuditService, PlatformGuard],
})
export class PlatformModule {}
