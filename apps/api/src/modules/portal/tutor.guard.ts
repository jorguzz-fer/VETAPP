import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { EnvConfig } from '../../config/env';

// Contexto do TUTOR autenticado (portal do cliente). Separado do AuthContext da
// gestão de propósito — o tutor só enxerga os próprios dados (doc 13 §5.2).
export interface TutorContext {
  credentialId: string;
  tenantId: string;
  responsavelId: string;
}

declare module 'express' {
  interface Request {
    tutor?: TutorContext;
  }
}

/**
 * Valida o access token do PORTAL (scope 'tutor') e injeta { credentialId,
 * tenantId, responsavelId } no request. Negação por padrão. Um token da gestão
 * (sem scope) é recusado aqui, e o token 'tutor' é recusado no JwtAuthGuard —
 * isolamento total entre as duas superfícies.
 */
@Injectable()
export class TutorGuard implements CanActivate {
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
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        tenantId: string;
        responsavelId: string;
        scope?: string;
      }>(token, { secret: this.env.JWT_ACCESS_SECRET, algorithms: ['HS256'] });
      if (payload.scope !== 'tutor') {
        throw new UnauthorizedException('Token inválido para o portal');
      }
      req.tutor = {
        credentialId: payload.sub,
        tenantId: payload.tenantId,
        responsavelId: payload.responsavelId,
      };
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Token inválido');
    }
  }
}
