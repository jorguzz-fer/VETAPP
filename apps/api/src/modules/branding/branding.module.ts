import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BrandingController } from './branding.controller';
import { BrandingService } from './branding.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

// Branding do tenant (logo da clínica). StorageService vem do StorageModule (global);
// AuditService vem do AuditModule (global).
@Module({
  imports: [JwtModule.register({})],
  controllers: [BrandingController],
  providers: [BrandingService, JwtAuthGuard, RolesGuard],
})
export class BrandingModule {}
