import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PublicSiteController } from './public-site.controller';
import { SiteController } from './site.controller';
import { SiteService } from './site.service';
import { RateLimiter } from './rate-limiter';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

// Site público (doc 13 §4). Controller público (sem guard) + gestão (JwtAuthGuard).
// StorageService vem do StorageModule (@Global).
@Module({
  imports: [JwtModule.register({})],
  controllers: [PublicSiteController, SiteController],
  providers: [SiteService, RateLimiter, JwtAuthGuard, RolesGuard],
})
export class SiteModule {}
