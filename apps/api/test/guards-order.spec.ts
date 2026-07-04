import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { FiscalController } from '../src/modules/fiscal/fiscal.controller';
import { SiteController } from '../src/modules/site/site.controller';
import { AppModule } from '../src/app.module';

/**
 * Regressão do bug de ORDEM DE GUARDS (RBAC).
 *
 * O RolesGuard depende de `req.auth`, populado pelo JwtAuthGuard. Se o RolesGuard
 * rodar antes (ex.: registrado como APP_GUARD global — guards globais rodam antes
 * dos de controller), `req.auth` é undefined → 403 em TODA rota com @Roles, mesmo
 * com token válido. Este teste trava a correção: nos controllers com @Roles, os
 * guards devem estar no controller na ordem [JwtAuthGuard, RolesGuard]; e o
 * RolesGuard NÃO pode ser um guard global.
 */
describe('Ordem dos guards de RBAC (@Roles)', () => {
  for (const Controller of [FiscalController, SiteController]) {
    it(`${Controller.name}: JwtAuthGuard vem antes do RolesGuard`, () => {
      const guards: unknown[] = Reflect.getMetadata(GUARDS_METADATA, Controller) ?? [];
      const jwtIdx = guards.indexOf(JwtAuthGuard);
      const rolesIdx = guards.indexOf(RolesGuard);
      expect(jwtIdx, 'JwtAuthGuard ausente no controller').toBeGreaterThanOrEqual(0);
      expect(rolesIdx, 'RolesGuard ausente no controller').toBeGreaterThanOrEqual(0);
      expect(jwtIdx).toBeLessThan(rolesIdx);
    });
  }

  it('AppModule NÃO registra RolesGuard como guard global (APP_GUARD)', () => {
    const providers: Array<{ provide?: unknown; useClass?: unknown }> =
      Reflect.getMetadata('providers', AppModule) ?? [];
    const globalRoles = providers.some(
      (p) => p && typeof p === 'object' && p.provide === 'APP_GUARD' && p.useClass === RolesGuard,
    );
    expect(globalRoles, 'RolesGuard global roda antes do JwtAuthGuard → 403').toBe(false);
  });
});
