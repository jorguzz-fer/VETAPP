import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { ProntuarioModule } from './modules/prontuario/prontuario.module';
import { AgendaModule } from './modules/agenda/agenda.module';
import { CatalogoModule } from './modules/catalogo/catalogo.module';
import { StorageModule } from './modules/storage/storage.module';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    StorageModule,
    HealthModule,
    AuthModule,
    ClientesModule,
    ProntuarioModule,
    AgendaModule,
    CatalogoModule,
  ],
  providers: [
    // RolesGuard global: rotas anotadas com @Roles são checadas; demais passam.
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
