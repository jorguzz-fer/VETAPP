import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

// ───────── Público ─────────

export class PublicSiteDto {
  @ApiProperty() slug!: string;
  @ApiPropertyOptional({ type: String }) nomeExibicao?: string | null;
  @ApiPropertyOptional({ type: String }) sobre?: string | null;
  @ApiProperty({ type: [String] }) servicos!: string[];
  @ApiPropertyOptional({ type: String }) endereco?: string | null;
  @ApiPropertyOptional({ type: String }) telefone?: string | null;
  @ApiPropertyOptional({ type: String }) whatsapp?: string | null;
  @ApiPropertyOptional({ type: String }) email?: string | null;
  @ApiPropertyOptional({ type: String }) horario?: string | null;
  @ApiPropertyOptional({ type: String }) corPrimaria?: string | null;
  @ApiPropertyOptional({ type: String }) logoUrl?: string | null;
}

export class CreateSolicitacaoDto {
  @ApiProperty({ example: 'Maria Silva' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome!: string;

  @ApiProperty({ example: '+55 11 99999-0000' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  telefone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  petNome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  servicoDesejado?: string;

  @ApiPropertyOptional({ description: 'Preferência de dia/horário (texto livre)' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  preferencia?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  mensagem?: string;

  @ApiPropertyOptional({ description: 'Como nos conheceu?' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  origem?: string;

  // Honeypot anti-spam: campo oculto no form; se vier preenchido, é bot.
  @ApiPropertyOptional({ description: 'Deixe em branco (anti-spam)' })
  @IsOptional()
  @IsString()
  website?: string;
}

// ───────── Admin (CMS + triagem) ─────────

export class SiteConfigDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional({ type: String }) slug?: string | null;
  @ApiProperty() publicado!: boolean;
  @ApiPropertyOptional({ type: String }) nomeExibicao?: string | null;
  @ApiPropertyOptional({ type: String }) sobre?: string | null;
  @ApiPropertyOptional({ type: String }) servicos?: string | null;
  @ApiPropertyOptional({ type: String }) endereco?: string | null;
  @ApiPropertyOptional({ type: String }) telefone?: string | null;
  @ApiPropertyOptional({ type: String }) whatsapp?: string | null;
  @ApiPropertyOptional({ type: String }) email?: string | null;
  @ApiPropertyOptional({ type: String }) horario?: string | null;
  @ApiPropertyOptional({ type: String }) corPrimaria?: string | null;
  @ApiPropertyOptional({ type: String }) logoUrl?: string | null;
}

export class UpdateSiteConfigDto {
  @ApiPropertyOptional({ description: 'Slug da URL pública (a-z, 0-9, hífen)' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  @Matches(/^[a-z0-9-]+$/, { message: 'slug: use apenas letras minúsculas, números e hífen' })
  slug?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  publicado?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nomeExibicao?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  sobre?: string;

  @ApiPropertyOptional({ description: 'Serviços em destaque, um por linha' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  servicos?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  endereco?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  whatsapp?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  horario?: string;

  @ApiPropertyOptional({ description: 'Cor primária em hex (#RRGGBB)' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'corPrimaria: use hex #RRGGBB' })
  corPrimaria?: string;
}

export class SolicitacaoDto {
  @ApiProperty() id!: string;
  @ApiProperty() nome!: string;
  @ApiProperty() telefone!: string;
  @ApiPropertyOptional({ type: String }) email?: string | null;
  @ApiPropertyOptional({ type: String }) petNome?: string | null;
  @ApiPropertyOptional({ type: String }) servicoDesejado?: string | null;
  @ApiPropertyOptional({ type: String }) preferencia?: string | null;
  @ApiPropertyOptional({ type: String }) mensagem?: string | null;
  @ApiPropertyOptional({ type: String }) origem?: string | null;
  @ApiProperty() status!: string;
  @ApiPropertyOptional({ type: String }) observacaoInterna?: string | null;
  @ApiPropertyOptional({ type: String, description: 'Cliente criado a partir desta solicitação' })
  responsavelId?: string | null;
  @ApiProperty() criadaEm!: string;
}

export class ConverterResultDto {
  @ApiProperty({ description: 'ID do cliente/responsável criado' }) responsavelId!: string;
  @ApiProperty({ type: SolicitacaoDto }) solicitacao!: SolicitacaoDto;
}

export class TriagemDto {
  @ApiPropertyOptional({ description: 'Observação interna (opcional)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string;
}

export class SignLogoDto {
  @ApiProperty({ example: 'image/png' })
  @IsString()
  @IsNotEmpty()
  contentType!: string;
}

export class SignUploadResponseDto {
  @ApiProperty() key!: string;
  @ApiProperty() uploadUrl!: string;
}

export class ConfirmLogoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  key!: string;
}

export class OkDto {
  @ApiProperty() ok!: boolean;
}
