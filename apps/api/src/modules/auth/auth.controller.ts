import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthMeDto, LoginDto, RegisterDto, TokensDto } from './auth.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiCreatedResponse({ type: TokensDto })
  register(@Body() dto: RegisterDto): Promise<TokensDto> {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOkResponse({ type: TokensDto })
  login(@Body() dto: LoginDto): Promise<TokensDto> {
    return this.auth.login(dto);
  }

  // Exemplo de rota protegida: retorna o contexto autenticado (userId/tenant/role).
  @Get('me')
  @ApiBearerAuth()
  @ApiOkResponse({ type: AuthMeDto })
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request): AuthMeDto {
    const auth = req.auth!;
    return { userId: auth.userId, tenantId: auth.tenantId, role: auth.role };
  }
}
