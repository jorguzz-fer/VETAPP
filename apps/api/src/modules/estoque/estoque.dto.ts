import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export const TIPOS_MOVIMENTO = ['entrada', 'saida', 'ajuste'] as const;

export class CreateMovimentoDto {
  @ApiProperty({ description: 'Item do catálogo (estocável)' })
  @IsUUID()
  itemId!: string;

  @ApiProperty({ enum: TIPOS_MOVIMENTO })
  @IsIn(TIPOS_MOVIMENTO as unknown as string[])
  tipo!: string;

  @ApiProperty({
    type: Number,
    description:
      'Quantidade. entrada/saida: magnitude positiva; ajuste: delta com sinal (inventário).',
    example: 10,
  })
  @IsInt()
  quantidade!: number;

  @ApiPropertyOptional({ type: Number, description: 'Custo unitário em centavos (entrada)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  custoCentavos?: number;

  @ApiPropertyOptional({ description: 'Lote (informado na entrada)' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  lote?: string;

  @ApiPropertyOptional({ description: 'Validade do lote (YYYY-MM-DD, entrada)', example: '2027-01-31' })
  @IsOptional()
  @IsDateString()
  validade?: string;

  @ApiPropertyOptional({ description: 'Observação (NF, fornecedor, motivo do ajuste)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  motivo?: string;
}

export class SetMinimoDto {
  @ApiProperty({ type: Number, example: 5 })
  @IsInt()
  @Min(0)
  estoqueMinimo!: number;
}

export class SaldoItemDto {
  @ApiProperty() itemId!: string;
  @ApiProperty() codigo!: string;
  @ApiProperty() nome!: string;
  @ApiProperty() tipo!: string;
  @ApiProperty() saldo!: number;
  @ApiProperty() estoqueMinimo!: number;
  @ApiProperty() abaixoDoMinimo!: boolean;
}

export class MovimentoDto {
  @ApiProperty() id!: string;
  @ApiProperty() itemId!: string;
  @ApiProperty() tipo!: string;
  @ApiProperty() quantidade!: number;
  @ApiProperty({ type: Number, nullable: true }) custoCentavos!: number | null;
  @ApiProperty({ type: String, nullable: true }) lote!: string | null;
  @ApiProperty({ type: String, nullable: true }) validade!: string | null;
  @ApiProperty({ type: String, nullable: true }) motivo!: string | null;
  @ApiProperty() criadoEm!: string;
}

export class VencimentoDto {
  @ApiProperty() itemId!: string;
  @ApiProperty() codigo!: string;
  @ApiProperty() nome!: string;
  @ApiProperty({ type: String, nullable: true }) lote!: string | null;
  @ApiProperty() validade!: string;
  @ApiProperty({ description: 'Quantidade da entrada com este lote' }) quantidade!: number;
  @ApiProperty({ description: 'Dias até vencer (negativo = já vencido)' }) diasParaVencer!: number;
}

export class MovimentoResultDto extends MovimentoDto {
  @ApiProperty({ description: 'Saldo do item após a movimentação' }) saldoAtual!: number;
}
