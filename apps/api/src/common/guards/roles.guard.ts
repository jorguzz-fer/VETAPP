import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

export const ROLES_KEY = 'roles';
/** Decorator: restringe a rota aos papéis informados. Ex.: @Roles('admin','gestor') */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Autorização por papel (RBAC) no servidor. Usa o contexto injetado pelo
 * JwtAuthGuard. Sem papel suficiente → 403 (ver docs/spec/07).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const role = req.auth?.role;
    if (!role || !required.includes(role)) {
      throw new ForbiddenException('Permissão insuficiente');
    }
    return true;
  }
}
