import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { EnvConfig } from '../../config/env';

export interface AuthContext {
  userId: string;
  tenantId: string;
  role: string;
}

declare module 'express' {
  interface Request {
    auth?: AuthContext;
  }
}

/**
 * Valida o access token (Bearer) no servidor e injeta o contexto (userId, tenant,
 * role) no request. Negação por padrão: sem token válido → 401.
 * Toda rota de negócio deve exigir este guard (ver docs/spec/02).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    @Inject('ENV') private readonly env: EnvConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token ausente');
    }
    const token = header.slice('Bearer '.length);
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; tenantId: string; role: string }>(token, {
        secret: this.env.JWT_ACCESS_SECRET,
      });
      req.auth = { userId: payload.sub, tenantId: payload.tenantId, role: payload.role };
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido');
    }
  }
}
