import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformGuard } from './platform.guard';
import {
  PlatformLoginDto,
  PlatformLoginResultDto,
  PlatformLogoutDto,
  PlatformMeDto,
  PlatformMfaForcedEnableDto,
  PlatformMfaForcedEnableResponseDto,
  PlatformMfaForcedSetupDto,
  PlatformMfaSetupResponseDto,
  PlatformMfaVerifyDto,
  PlatformOkDto,
  PlatformRefreshDto,
  PlatformTokensDto,
} from './platform.dto';

// Auth do super-admin da plataforma (doc 15). Namespace isolado /api/platform/*.
@ApiTags('platform')
@Controller('platform/auth')
export class PlatformController {
  constructor(private readonly auth: PlatformAuthService) {}

  @Post('login')
  @HttpCode(200)
  @ApiOkResponse({ type: PlatformLoginResultDto })
  login(@Body() dto: PlatformLoginDto): Promise<PlatformLoginResultDto> {
    return this.auth.login(dto.email, dto.password);
  }

  @Post('mfa/verify')
  @HttpCode(200)
  @ApiOkResponse({ type: PlatformTokensDto })
  mfaVerify(@Req() req: Request, @Body() dto: PlatformMfaVerifyDto): Promise<PlatformTokensDto> {
    return this.auth.mfaVerify(dto.mfaToken, dto.code, req.ip);
  }

  @Post('mfa/forced-setup')
  @HttpCode(200)
  @ApiOkResponse({ type: PlatformMfaSetupResponseDto })
  mfaForcedSetup(@Body() dto: PlatformMfaForcedSetupDto): Promise<PlatformMfaSetupResponseDto> {
    return this.auth.mfaForcedSetup(dto.setupToken);
  }

  @Post('mfa/forced-enable')
  @HttpCode(200)
  @ApiOkResponse({ type: PlatformMfaForcedEnableResponseDto })
  mfaForcedEnable(@Req() req: Request, @Body() dto: PlatformMfaForcedEnableDto): Promise<PlatformMfaForcedEnableResponseDto> {
    return this.auth.mfaForcedEnable(dto.setupToken, dto.code, req.ip);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOkResponse({ type: PlatformTokensDto })
  refresh(@Body() dto: PlatformRefreshDto): Promise<PlatformTokensDto> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOkResponse({ type: PlatformOkDto })
  logout(@Req() req: Request, @Body() dto: PlatformLogoutDto): Promise<PlatformOkDto> {
    return this.auth.logout(dto.refreshToken, req.ip);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(PlatformGuard)
  @ApiOkResponse({ type: PlatformMeDto })
  me(@Req() req: Request): Promise<PlatformMeDto> {
    return this.auth.me(req.platformAdmin!.adminId);
  }
}
