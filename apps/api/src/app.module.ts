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
import { FinanceiroModule } from './modules/financeiro/financeiro.module';
import { EstoqueModule } from './modules/estoque/estoque.module';
import { InternacaoModule } from './modules/internacao/internacao.module';
import { VendasModule } from './modules/vendas/vendas.module';
import { ComissoesModule } from './modules/comissoes/comissoes.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { InteligenciaModule } from './modules/inteligencia/inteligencia.module';
import { PortalModule } from './modules/portal/portal.module';
import { FiscalModule } from './modules/fiscal/fiscal.module';
import { SiteModule } from './modules/site/site.module';
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
    FinanceiroModule,
    EstoqueModule,
    InternacaoModule,
    VendasModule,
    ComissoesModule,
    DashboardModule,
    InteligenciaModule,
    PortalModule,
    FiscalModule,
    SiteModule,
  ],
  providers: [
    // RolesGuard global: rotas anotadas com @Roles são checadas; demais passam.
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
