import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Clínica Cuidar' })
  tenantName!: string;

  @ApiProperty({ example: 'dono@clinica.com' })
  email!: string;

  @ApiProperty({ example: 'Maria Dona' })
  name!: string;

  @ApiProperty({ example: 'senha-forte-aqui', minLength: 8 })
  password!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'dono@clinica.com' })
  email!: string;

  @ApiProperty({ example: 'senha-forte-aqui' })
  password!: string;

  @ApiProperty({ description: 'Tenant ativo (quando o usuário pertence a mais de um)', required: false })
  tenantId?: string;
}

export class TokensDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;
}

export class AuthMeDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty({ example: 'admin' })
  role!: string;
}

// Login pode exigir um segundo fator: nesse caso vem mfaRequired + mfaToken
// (token curto, escopo 'mfa') em vez dos tokens de sessão.
export class LoginResultDto {
  @ApiProperty({ type: String, required: false })
  accessToken?: string;

  @ApiProperty({ type: String, required: false })
  refreshToken?: string;

  @ApiProperty({ type: Boolean, required: false })
  mfaRequired?: boolean;

  @ApiProperty({ type: String, required: false, description: 'Token temporário para concluir o MFA' })
  mfaToken?: string;
}

export class MfaVerifyDto {
  @ApiProperty({ description: 'mfaToken devolvido pelo login' })
  mfaToken!: string;

  @ApiProperty({ example: '123456', description: 'Código TOTP do autenticador' })
  code!: string;
}

export class MfaCodeDto {
  @ApiProperty({ example: '123456' })
  code!: string;
}

export class MfaSetupResponseDto {
  @ApiProperty({ description: 'Segredo TOTP (base32) — exibir uma única vez' })
  secret!: string;

  @ApiProperty({ description: 'URL otpauth:// para QR code' })
  otpauthUrl!: string;
}

export class MfaStatusDto {
  @ApiProperty()
  enabled!: boolean;
}

export class GoogleLoginDto {
  @ApiProperty({ description: 'id_token retornado pelo Google Identity Services' })
  idToken!: string;
}

export class OkResponseDto {
  @ApiProperty()
  ok!: boolean;
}
