import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class PlatformLoginDto {
  @ApiProperty({ example: 'dono@vetapp.com' })
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class PlatformTokensDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
}

// Login do super-admin pode exigir MFA (obrigatório): desafio (mfaRequired) ou
// setup forçado (mfaSetupRequired) — doc 15 §2.
export class PlatformLoginResultDto {
  @ApiProperty({ type: String, required: false }) accessToken?: string;
  @ApiProperty({ type: String, required: false }) refreshToken?: string;
  @ApiProperty({ type: Boolean, required: false }) mfaRequired?: boolean;
  @ApiProperty({ type: String, required: false }) mfaToken?: string;
  @ApiProperty({ type: Boolean, required: false }) mfaSetupRequired?: boolean;
  @ApiProperty({ type: String, required: false }) mfaSetupToken?: string;
}

export class PlatformMfaVerifyDto {
  @ApiProperty() @IsString() @IsNotEmpty() mfaToken!: string;
  @ApiProperty({ example: '123456' }) @IsString() @Length(6, 20) code!: string;
}

export class PlatformMfaForcedSetupDto {
  @ApiProperty() @IsString() @IsNotEmpty() setupToken!: string;
}

export class PlatformMfaForcedEnableDto {
  @ApiProperty() @IsString() @IsNotEmpty() setupToken!: string;
  @ApiProperty({ example: '123456' }) @IsString() @Length(6, 6) code!: string;
}

export class PlatformMfaSetupResponseDto {
  @ApiProperty() secret!: string;
  @ApiProperty() otpauthUrl!: string;
}

export class PlatformMfaForcedEnableResponseDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ type: [String] }) recoveryCodes!: string[];
}

export class PlatformRefreshDto {
  @ApiProperty() @IsString() @IsNotEmpty() refreshToken!: string;
}

export class PlatformLogoutDto {
  @ApiProperty() @IsString() @IsNotEmpty() refreshToken!: string;
}

export class PlatformOkDto {
  @ApiProperty() ok!: boolean;
}

export class PlatformMeDto {
  @ApiProperty() adminId!: string;
  @ApiProperty() email!: string;
  @ApiProperty() nome!: string;
}
