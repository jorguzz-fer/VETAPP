import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PlatformController } from './platform.controller';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformAuditService } from './platform-audit.service';
import { PlatformBootstrapService } from './platform-bootstrap.service';
import { PlatformGuard } from './platform.guard';

// Admin da Plataforma (SaaS back-office) — doc 15. Stage 1: auth do super-admin.
// DatabaseService vem do DatabaseModule (global). PlatformAuditService/Guard
// exportados para os próximos stages (tenants/assinaturas).
@Module({
  imports: [JwtModule.register({})],
  controllers: [PlatformController],
  providers: [PlatformAuthService, PlatformAuditService, PlatformBootstrapService, PlatformGuard],
  exports: [PlatformAuditService, PlatformGuard],
})
export class PlatformModule {}
