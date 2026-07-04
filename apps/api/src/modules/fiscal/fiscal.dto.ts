import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

const REGIMES = ['simples', 'presumido', 'real'] as const;
const PROVEDORES = ['manual', 'focus', 'nfe_io', 'plugnotas'] as const;
const AMBIENTES = ['homologacao', 'producao'] as const;

export class FiscalConfigDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional({ type: String }) cnpj?: string | null;
  @ApiPropertyOptional({ type: String }) razaoSocial?: string | null;
  @ApiPropertyOptional({ type: String }) inscricaoMunicipal?: string | null;
  @ApiProperty() regimeTributario!: string;
  @ApiProperty() serieNfse!: string;
  @ApiProperty() proximoNumero!: number;
  @ApiProperty() provedor!: string;
  @ApiProperty() ambiente!: string;
  @ApiProperty() ativo!: boolean;
}

export class UpdateFiscalConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(18)
  cnpj?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  razaoSocial?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  inscricaoMunicipal?: string;

  @ApiPropertyOptional({ enum: REGIMES })
  @IsOptional()
  @IsIn(REGIMES as unknown as string[])
  regimeTributario?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5)
  serieNfse?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  proximoNumero?: number;

  @ApiPropertyOptional({ enum: PROVEDORES })
  @IsOptional()
  @IsIn(PROVEDORES as unknown as string[])
  provedor?: string;

  @ApiPropertyOptional({ enum: AMBIENTES })
  @IsOptional()
  @IsIn(AMBIENTES as unknown as string[])
  ambiente?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  ativo?: boolean;
}

export class CriarNotaDto {
  @ApiPropertyOptional({ enum: ['nfse', 'nfe'], default: 'nfse' })
  @IsOptional()
  @IsIn(['nfse', 'nfe'])
  tipo?: string;
}

export class CancelarNotaDto {
  @ApiProperty({ example: 'Emitida em duplicidade' })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  motivo!: string;
}

export class NotaFiscalDto {
  @ApiProperty() id!: string;
  @ApiProperty() faturaId!: string;
  @ApiProperty() responsavelId!: string;
  @ApiPropertyOptional({ type: String }) responsavelNome?: string | null;
  @ApiProperty() tipo!: string;
  @ApiProperty() status!: string;
  @ApiPropertyOptional({ type: String }) numero?: string | null;
  @ApiPropertyOptional({ type: String }) serie?: string | null;
  @ApiProperty() valorCentavos!: number;
  @ApiPropertyOptional({ type: String }) mensagem?: string | null;
  @ApiPropertyOptional({ type: String }) emitidaEm?: string | null;
  @ApiProperty() criadaEm!: string;
}

export class OkDto {
  @ApiProperty() ok!: boolean;
}
