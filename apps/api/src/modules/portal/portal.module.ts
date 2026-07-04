import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PortalController } from './portal.controller';
import { PortalAdminController } from './portal-admin.controller';
import { PortalAuthService } from './portal-auth.service';
import { PortalService } from './portal.service';
import { TutorGuard } from './tutor.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

// Portal do tutor (doc 13 §5). Auth do tutor totalmente separada da gestão.
// StorageService vem do StorageModule (@Global).
@Module({
  imports: [JwtModule.register({})],
  controllers: [PortalController, PortalAdminController],
  providers: [PortalAuthService, PortalService, TutorGuard, JwtAuthGuard],
})
export class PortalModule {}
