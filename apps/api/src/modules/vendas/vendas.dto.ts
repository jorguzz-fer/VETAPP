import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateOrcamentoDto {
  @ApiProperty({ description: 'Responsável (cliente) do orçamento' })
  @IsUUID()
  responsavelId!: string;

  @ApiPropertyOptional({ example: 'Pacote pós-cirúrgico' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacoes?: string;
}

export class AddOrcamentoItemDto {
  @ApiPropertyOptional({ description: 'Item do catálogo (herda nome/preço)' })
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @ApiPropertyOptional({ description: 'Descrição livre (obrigatória sem itemId)' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  descricao?: string;

  @ApiPropertyOptional({ type: Number, example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantidade?: number;

  @ApiPropertyOptional({ type: Number, description: 'Valor unitário em centavos; default = preço do catálogo' })
  @IsOptional()
  @IsInt()
  @Min(0)
  valorCentavos?: number;
}

export class UpdateOrcamentoStatusDto {
  @ApiProperty({ enum: ['aprovado', 'recusado'] })
  @IsIn(['aprovado', 'recusado'])
  status!: string;
}

export class OrcamentoItemDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: String, nullable: true }) itemId!: string | null;
  @ApiProperty() descricao!: string;
  @ApiProperty() quantidade!: number;
  @ApiProperty() valorCentavos!: number;
}

export class OrcamentoResumoDto {
  @ApiProperty() id!: string;
  @ApiProperty() responsavelId!: string;
  @ApiProperty() responsavelNome!: string;
  @ApiProperty() status!: string;
  @ApiProperty() totalCentavos!: number;
  @ApiProperty() itens!: number;
  @ApiProperty({ type: String, nullable: true }) observacoes!: string | null;
  @ApiProperty() criadoEm!: string;
}

export class OrcamentoDetalheDto extends OrcamentoResumoDto {
  @ApiProperty({ type: [OrcamentoItemDto] }) linhas!: OrcamentoItemDto[];
}

export class ConverterResultDto {
  @ApiProperty() ok!: boolean;
  @ApiProperty({ description: 'Total lançado na fatura aberta (centavos)' }) totalCentavos!: number;
}
