import { Module } from '@nestjs/common';
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
import { ModelosModule } from './modules/modelos/modelos.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { AuditModule } from './modules/audit/audit.module';
import { BrandingModule } from './modules/branding/branding.module';
import { LgpdModule } from './modules/lgpd/lgpd.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { PlatformModule } from './modules/platform/platform.module';
import { StorageModule } from './modules/storage/storage.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AuditModule,
    SessionsModule,
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
    ModelosModule,
    UsuariosModule,
    BrandingModule,
    LgpdModule,
    PlatformModule,
  ],
  // NB: RBAC (RolesGuard) NÃO é global. Um guard global roda ANTES dos guards de
  // controller (JwtAuthGuard), então o RolesGuard leria req.auth antes de ele ser
  // populado → 403 em toda rota com @Roles. Por isso o RolesGuard é aplicado junto
  // do JwtAuthGuard, na ordem certa, nos controllers que usam @Roles
  // (`@UseGuards(JwtAuthGuard, RolesGuard)`). Ver docs/blueprint §6.
})
export class AppModule {}
