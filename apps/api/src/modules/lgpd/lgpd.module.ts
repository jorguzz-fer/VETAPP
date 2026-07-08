import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { LgpdController } from './lgpd.controller';
import { LgpdService } from './lgpd.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

// LGPD: exportação de dados do titular (doc 09 §5). AuditService vem do AuditModule
// (global). Restrito a admin/gestor.
@Module({
  imports: [JwtModule.register({})],
  controllers: [LgpdController],
  providers: [LgpdService, JwtAuthGuard, RolesGuard],
})
export class LgpdModule {}
