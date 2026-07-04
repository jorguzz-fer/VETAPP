import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, Length, MaxLength, MinLength } from 'class-validator';

// ATENÇÃO: DTOs de ENTRADA (@Body) precisam de decorators do class-validator.
// O ValidationPipe global usa whitelist:true — propriedade sem decorator de
// validação é REMOVIDA do body (o service recebe undefined e a query quebra).

export class RegisterDto {
  @ApiProperty({ example: 'Clínica Cuidar' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  tenantName!: string;

  @ApiProperty({ example: 'dono@clinica.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Maria Dona' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'senha-forte-aqui', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'dono@clinica.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'senha-forte-aqui' })
  @IsString()
  @IsNotEmpty()
  password!: string;

  @ApiProperty({ description: 'Tenant ativo (quando o usuário pertence a mais de um)', required: false })
  @IsOptional()
  @IsUUID()
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
  @IsString()
  @IsNotEmpty()
  mfaToken!: string;

  // Aceita TOTP (6 dígitos) OU recovery code (formato xxxx-xxxx). Comprimento
  // frouxo de propósito; o service decide qual caminho validar.
  @ApiProperty({ example: '123456', description: 'Código TOTP ou recovery code' })
  @IsString()
  @Length(6, 20)
  code!: string;
}

export class MfaCodeDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code!: string;
}

export class RefreshDto {
  @ApiProperty({ description: 'Refresh token da sessão' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class LogoutDto {
  @ApiProperty({ description: 'Refresh token da sessão a encerrar' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
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

  @ApiProperty({ description: 'Quantos recovery codes de uso único ainda restam' })
  recoveryCodesRemaining!: number;
}

export class MfaEnableResponseDto {
  @ApiProperty()
  ok!: boolean;

  @ApiProperty({
    type: [String],
    description: 'Recovery codes de uso único — exibidos UMA vez, guarde-os',
  })
  recoveryCodes!: string[];
}

export class GoogleLoginDto {
  @ApiProperty({ description: 'id_token retornado pelo Google Identity Services' })
  @IsString()
  @IsNotEmpty()
  idToken!: string;
}

export class OkResponseDto {
  @ApiProperty()
  ok!: boolean;
}
