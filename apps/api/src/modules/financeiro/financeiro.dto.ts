import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';

export const TIPOS_FORMA = [
  'dinheiro',
  'pix',
  'cartao_credito',
  'cartao_debito',
  'transferencia',
  'outro',
] as const;

export class FaturaResumoDto {
  @ApiProperty() id!: string;
  @ApiProperty() responsavelId!: string;
  @ApiProperty() responsavelNome!: string;
  @ApiProperty() status!: string; // aberta | parcial | paga | cancelada
  @ApiProperty() totalCentavos!: number;
  @ApiProperty({ description: 'Total já recebido (soma dos recebimentos)' }) recebidoCentavos!: number;
  @ApiProperty() itens!: number;
  @ApiProperty() criadaEm!: string;
}

export class OkDto {
  @ApiProperty() ok!: boolean;
}

export class ReceberDto {
  @ApiProperty({ type: Number, description: 'Valor recebido em centavos (≤ saldo em aberto)' })
  @IsInt()
  @Min(1)
  valorCentavos!: number;

  @ApiPropertyOptional({ type: String, description: 'Forma de recebimento' })
  @IsOptional()
  @IsUUID()
  formaId?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  observacao?: string;
}

export class RecebimentoDto {
  @ApiProperty() id!: string;
  @ApiProperty() valorCentavos!: number;
  @ApiProperty({ type: String, nullable: true }) formaId!: string | null;
  @ApiProperty({ type: String, nullable: true }) formaNome!: string | null;
  @ApiProperty({ type: String, nullable: true }) observacao!: string | null;
  @ApiProperty() criadoEm!: string;
}

export class ReceberResultDto {
  @ApiProperty() ok!: boolean;
  @ApiProperty() status!: string;
  @ApiProperty() recebidoCentavos!: number;
  @ApiProperty() saldoCentavos!: number;
}

export class CreateFormaDto {
  @ApiProperty({ example: 'Pix' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  nome!: string;

  @ApiProperty({ enum: TIPOS_FORMA })
  @IsIn(TIPOS_FORMA as unknown as string[])
  tipo!: string;

  @ApiPropertyOptional({ type: Number, description: 'Taxa em basis points (2,5% = 250)', example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  taxaBps?: number;
}

export class UpdateFormaDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(60) nome?: string;
  @ApiPropertyOptional({ type: Number }) @IsOptional() @IsInt() @Min(0) taxaBps?: number;
  @ApiPropertyOptional({ type: Boolean }) @IsOptional() @IsBoolean() ativo?: boolean;
}

export class FormaRecebimentoDto {
  @ApiProperty() id!: string;
  @ApiProperty() nome!: string;
  @ApiProperty() tipo!: string;
  @ApiProperty() taxaBps!: number;
  @ApiProperty() ativo!: boolean;
}

export class SaldoClienteDto {
  @ApiProperty() responsavelId!: string;
  @ApiProperty() responsavelNome!: string;
  @ApiProperty({ description: 'Saldo devedor em aberto (centavos)' }) devedorCentavos!: number;
  @ApiProperty() faturasAbertas!: number;
}
