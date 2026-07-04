import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

// Item de uma lista gerenciada da admissão (motivo/box).
export class ItemListaDto {
  @ApiProperty() id!: string;
  @ApiProperty() nome!: string;
}

export class CriarItemListaDto {
  @ApiProperty({ example: 'Pós-operatório' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome!: string;
}

export class AdmitirDto {
  @ApiProperty({ description: 'Animal a internar' })
  @IsUUID()
  animalId!: string;

  @ApiProperty({ example: 'Pós-operatório de castração' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  motivo!: string;

  @ApiPropertyOptional({ example: 'Box 2' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  box?: string;
}

export class PrescreverDto {
  @ApiPropertyOptional({ description: 'Item do catálogo (medicamento/procedimento)' })
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @ApiPropertyOptional({ description: 'Descrição livre (obrigatória sem itemId)', example: 'Dipirona 25mg/kg IV' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  descricao?: string;

  @ApiPropertyOptional({ type: Number, description: 'Quantidade (baixa de estoque por execução)', example: 1 })
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

export class AltaDto {
  @ApiPropertyOptional({ example: 'Alta com retorno em 7 dias' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacoes?: string;
}

export class ExecucaoDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: String, nullable: true }) itemId!: string | null;
  @ApiProperty() descricao!: string;
  @ApiProperty() quantidade!: number;
  @ApiProperty({ type: Number, nullable: true }) valorCentavos!: number | null;
  @ApiProperty({ type: String, nullable: true }) executadaEm!: string | null;
}

export class ExecutarResultDto extends ExecucaoDto {
  @ApiProperty({ description: 'false quando não havia saldo em estoque (execução registrada mesmo assim)' })
  estoqueBaixado!: boolean;
  @ApiProperty({ description: 'true quando o valor foi lançado na fatura aberta' })
  faturado!: boolean;
}

export class InternacaoResumoDto {
  @ApiProperty() id!: string;
  @ApiProperty() animalId!: string;
  @ApiProperty() animalNome!: string;
  @ApiProperty() responsavelId!: string;
  @ApiProperty() responsavelNome!: string;
  @ApiProperty() motivo!: string;
  @ApiProperty({ type: String, nullable: true }) box!: string | null;
  @ApiProperty() status!: string;
  @ApiProperty() entradaEm!: string;
  @ApiProperty({ type: String, nullable: true }) altaEm!: string | null;
  @ApiProperty({ description: 'Prescrições ainda não executadas' }) pendentes!: number;
}

export class InternacaoDetalheDto extends InternacaoResumoDto {
  @ApiProperty({ type: String, nullable: true }) observacoes!: string | null;
  @ApiProperty({ type: [ExecucaoDto] }) execucoes!: ExecucaoDto[];
}
