import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import {
  AuthMeDto,
  GoogleLoginDto,
  LoginDto,
  LoginResultDto,
  LogoutDto,
  MfaCodeDto,
  MfaEnableResponseDto,
  MfaForcedEnableDto,
  MfaForcedEnableResponseDto,
  MfaForcedSetupDto,
  MfaSetupResponseDto,
  MfaStatusDto,
  MfaVerifyDto,
  OkResponseDto,
  RefreshDto,
  RegisterDto,
  TokensDto,
} from './auth.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Anti-abuso: no máx. 5 cadastros por IP/hora.
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @Post('register')
  @ApiCreatedResponse({ type: TokensDto })
  register(@Req() req: Request, @Body() dto: RegisterDto): Promise<TokensDto> {
    return this.auth.register(dto, req.ip);
  }

  // Anti-brute-force: 10 tentativas de login por IP/min.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  @ApiOkResponse({ type: LoginResultDto })
  login(@Req() req: Request, @Body() dto: LoginDto): Promise<LoginResultDto> {
    return this.auth.login(dto, req.ip);
  }

  // Login com Google (id_token validado no servidor — docs/spec/02 §2.1).
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('google')
  @HttpCode(200)
  @ApiOkResponse({ type: LoginResultDto })
  google(@Req() req: Request, @Body() dto: GoogleLoginDto): Promise<LoginResultDto> {
    return this.auth.googleLogin(dto.idToken, undefined, req.ip);
  }

  // Conclui o login quando o usuário tem MFA ativo.
  @Post('mfa/verify')
  @HttpCode(200)
  @ApiOkResponse({ type: TokensDto })
  mfaVerify(@Req() req: Request, @Body() dto: MfaVerifyDto): Promise<TokensDto> {
    return this.auth.mfaVerify(dto.mfaToken, dto.code, req.ip);
  }

  // MFA obrigatório por papel — setup forçado. Autorizado pelo mfaSetupToken (no
  // body), não por sessão: o usuário ainda não tem sessão (doc 02 §2.2).
  @Post('mfa/forced-setup')
  @HttpCode(200)
  @ApiOkResponse({ type: MfaSetupResponseDto })
  mfaForcedSetup(@Body() dto: MfaForcedSetupDto): Promise<MfaSetupResponseDto> {
    return this.auth.mfaForcedSetup(dto.setupToken);
  }

  @Post('mfa/forced-enable')
  @HttpCode(200)
  @ApiOkResponse({ type: MfaForcedEnableResponseDto })
  mfaForcedEnable(@Req() req: Request, @Body() dto: MfaForcedEnableDto): Promise<MfaForcedEnableResponseDto> {
    return this.auth.mfaForcedEnable(dto.setupToken, dto.code, req.ip);
  }

  // Rotação de refresh token (stateful, com detecção de reuso — docs/spec/02 §2.2).
  @Post('refresh')
  @HttpCode(200)
  @ApiOkResponse({ type: TokensDto })
  refresh(@Body() dto: RefreshDto): Promise<TokensDto> {
    return this.auth.refresh(dto.refreshToken);
  }

  // Logout: revoga a family do refresh apresentado.
  @Post('logout')
  @HttpCode(200)
  @ApiOkResponse({ type: OkResponseDto })
  logout(@Req() req: Request, @Body() dto: LogoutDto): Promise<OkResponseDto> {
    return this.auth.logout(dto.refreshToken, req.ip);
  }

  // ───────── Gestão do MFA (autenticado) ─────────

  @Get('mfa/status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ type: MfaStatusDto })
  mfaStatus(@Req() req: Request): Promise<MfaStatusDto> {
    return this.auth.mfaStatus(req.auth!.userId);
  }

  @Post('mfa/setup')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiCreatedResponse({ type: MfaSetupResponseDto })
  mfaSetup(@Req() req: Request): Promise<MfaSetupResponseDto> {
    return this.auth.mfaSetup(req.auth!.userId);
  }

  @Post('mfa/enable')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiOkResponse({ type: MfaEnableResponseDto })
  mfaEnable(@Req() req: Request, @Body() dto: MfaCodeDto): Promise<MfaEnableResponseDto> {
    return this.auth.mfaEnable(req.auth!.userId, dto.code);
  }

  // Regera os recovery codes (exige TOTP válido). Invalida os anteriores.
  @Post('mfa/recovery-codes')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiOkResponse({ type: MfaEnableResponseDto })
  regenerateRecoveryCodes(@Req() req: Request, @Body() dto: MfaCodeDto): Promise<MfaEnableResponseDto> {
    return this.auth.regenerateRecoveryCodes(req.auth!.userId, dto.code);
  }

  @Post('mfa/disable')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiOkResponse({ type: OkResponseDto })
  mfaDisable(@Req() req: Request, @Body() dto: MfaCodeDto): Promise<OkResponseDto> {
    return this.auth.mfaDisable(req.auth!.userId, dto.code);
  }

  // Rota protegida: retorna o contexto autenticado (userId/tenant/role).
  @Get('me')
  @ApiBearerAuth()
  @ApiOkResponse({ type: AuthMeDto })
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request): AuthMeDto {
    const auth = req.auth!;
    return { userId: auth.userId, tenantId: auth.tenantId, role: auth.role };
  }
}
