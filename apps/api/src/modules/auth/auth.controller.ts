import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, TokensDto } from './auth.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto): Promise<TokensDto> {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto): Promise<TokensDto> {
    return this.auth.login(dto);
  }

  // Exemplo de rota protegida: retorna o contexto autenticado (userId/tenant/role).
  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request): Request['auth'] {
    return req.auth;
  }
}
