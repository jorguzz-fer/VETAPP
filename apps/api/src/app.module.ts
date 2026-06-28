import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { ProntuarioModule } from './modules/prontuario/prontuario.module';
import { AgendaModule } from './modules/agenda/agenda.module';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    HealthModule,
    AuthModule,
    ClientesModule,
    ProntuarioModule,
    AgendaModule,
  ],
  providers: [
    // RolesGuard global: rotas anotadas com @Roles são checadas; demais passam.
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
