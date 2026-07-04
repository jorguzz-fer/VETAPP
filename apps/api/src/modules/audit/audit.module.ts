import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

// Trilha de auditoria (LGPD) — doc 02 §6. @Global para o AuditService.registrar
// ser injetável em qualquer módulo (auth, usuários, fiscal, financeiro) sem
// reimportar. A consulta (GET /api/auditoria) é admin-only.
@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuditController],
  providers: [AuditService, JwtAuthGuard, RolesGuard],
  exports: [AuditService],
})
export class AuditModule {}
