import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { EnvConfig } from '../../config/env';

export interface PlatformContext {
  adminId: string;
}

declare module 'express' {
  interface Request {
    platformAdmin?: PlatformContext;
  }
}

/**
 * Valida o access token do super-admin (escopo 'platform') e injeta o contexto.
 * Negação por padrão. NÃO aceita tokens da gestão/tutor (sem scope ou outro scope).
 * Doc 15 §2.
 */
@Injectable()
export class PlatformGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    @Inject('ENV') private readonly env: EnvConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Token ausente');
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; scope?: string }>(header.slice(7), {
        secret: this.env.JWT_ACCESS_SECRET,
      });
      if (payload.scope !== 'platform') throw new UnauthorizedException('Token sem escopo de plataforma');
      req.platformAdmin = { adminId: payload.sub };
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Token inválido');
    }
  }
}
