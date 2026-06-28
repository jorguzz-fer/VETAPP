import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [ConfigModule, DatabaseModule, HealthModule, AuthModule],
  providers: [
    // RolesGuard global: rotas anotadas com @Roles são checadas; demais passam.
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
