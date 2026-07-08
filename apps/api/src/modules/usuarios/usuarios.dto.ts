import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const PAPEIS = ['admin', 'gestor', 'veterinario', 'recepcao', 'financeiro', 'internacao'] as const;

export class UsuarioDto {
  @ApiProperty() userId!: string;
  @ApiProperty() nome!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ enum: PAPEIS }) role!: string;
  @ApiProperty({ description: 'active | disabled' }) status!: string;
  @ApiProperty() mfaEnabled!: boolean;
}

export class CriarUsuarioDto {
  @ApiProperty({ example: 'Dra. Carla Nunes' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  nome!: string;

  @ApiProperty({ example: 'carla@clinica.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: PAPEIS })
  @IsIn(PAPEIS)
  role!: string;
}

export class CriarUsuarioResultDto extends UsuarioDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Senha temporária (mostrada só uma vez). Null quando o usuário já existia (mantém a senha atual).',
  })
  senhaTemporaria!: string | null;
}

export class AtualizarUsuarioDto {
  @ApiPropertyOptional({ enum: PAPEIS })
  @IsOptional()
  @IsIn(PAPEIS)
  role?: string;

  @ApiPropertyOptional({ enum: ['active', 'disabled'] })
  @IsOptional()
  @IsIn(['active', 'disabled'])
  status?: string;
}

export class SenhaTemporariaDto {
  @ApiProperty({ description: 'Nova senha temporária (mostrada só uma vez).' })
  senhaTemporaria!: string;
}

export class OkDto {
  @ApiProperty() ok!: boolean;
}
