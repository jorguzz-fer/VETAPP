import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class CreateRegraDto {
  @ApiProperty({ description: 'Colaborador (membro do tenant)' })
  @IsUUID()
  userId!: string;

  @ApiPropertyOptional({ description: 'Item do catálogo; ausente = regra geral do colaborador' })
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @ApiProperty({ type: Number, description: 'Percentual em basis points (10% = 1000)', example: 1000 })
  @IsInt()
  @Min(0)
  @Max(10000)
  percentBps!: number;
}

export class RegraDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() userNome!: string;
  @ApiProperty({ type: String, nullable: true }) itemId!: string | null;
  @ApiProperty({ type: String, nullable: true }) itemNome!: string | null;
  @ApiProperty() percentBps!: number;
}

export class ApuracaoColaboradorDto {
  @ApiProperty() userId!: string;
  @ApiProperty() nome!: string;
  @ApiProperty({ description: 'Base comissionável no período (centavos)' }) baseCentavos!: number;
  @ApiProperty({ description: 'Comissão apurada no período (centavos)' }) comissaoCentavos!: number;
  @ApiProperty() lancamentos!: number;
}

export class ApuracaoLinhaDto {
  @ApiProperty() descricao!: string;
  @ApiProperty() valorCentavos!: number;
  @ApiProperty() percentBps!: number;
  @ApiProperty() comissaoCentavos!: number;
  @ApiProperty() criadoEm!: string;
}
