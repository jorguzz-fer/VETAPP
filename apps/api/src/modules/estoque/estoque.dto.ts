import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

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
  @ApiProperty({ type: String, nullable: true }) motivo!: string | null;
  @ApiProperty() criadoEm!: string;
}

export class MovimentoResultDto extends MovimentoDto {
  @ApiProperty({ description: 'Saldo do item após a movimentação' }) saldoAtual!: number;
}
