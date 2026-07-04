import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { FiscalController } from './fiscal.controller';
import { FiscalService } from './fiscal.service';
import { FiscalProviderFactory, ManualFiscalProvider } from './fiscal-provider';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

// Fiscal (doc 13 §3). Emissão via provedor pluggável (driver 'manual' por ora).
@Module({
  imports: [JwtModule.register({})],
  controllers: [FiscalController],
  providers: [FiscalService, FiscalProviderFactory, ManualFiscalProvider, JwtAuthGuard, RolesGuard],
})
export class FiscalModule {}
