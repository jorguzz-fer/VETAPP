import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

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

  @ApiPropertyOptional({ example: '2026-07-15', description: 'Previsão de alta (AAAA-MM-DD)' })
  @IsOptional()
  @IsString()
  altaPrevista?: string;
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
  @ApiProperty({ type: String, nullable: true }) altaPrevistaEm!: string | null;
  @ApiProperty({ type: String, nullable: true }) altaEm!: string | null;
  @ApiProperty({ description: 'Prescrições ainda não executadas' }) pendentes!: number;
  @ApiProperty({ type: String, nullable: true, description: 'URL assinada da foto do paciente' }) fotoUrl!: string | null;
}

export class InternacaoDetalheDto extends InternacaoResumoDto {
  @ApiProperty({ type: String, nullable: true }) observacoes!: string | null;
  @ApiProperty({ type: [ExecucaoDto] }) execucoes!: ExecucaoDto[];
}

// ───────── Modelos de prescrição (doc 05 §9.6) ─────────

export class ModeloPrescricaoItemDto {
  @ApiProperty({ type: String, nullable: true }) itemId!: string | null;
  @ApiProperty() descricao!: string;
  @ApiProperty() quantidade!: number;
}

export class ModeloPrescricaoDto {
  @ApiProperty() id!: string;
  @ApiProperty() nome!: string;
  @ApiProperty({ type: [ModeloPrescricaoItemDto] }) itens!: ModeloPrescricaoItemDto[];
}

export class CriarModeloPrescricaoItemDto {
  @ApiPropertyOptional({ description: 'Item do catálogo' })
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
}

export class CriarModeloPrescricaoDto {
  @ApiProperty({ example: 'Pós-cirúrgico padrão' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  nome!: string;

  @ApiProperty({ type: [CriarModeloPrescricaoItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CriarModeloPrescricaoItemDto)
  itens!: CriarModeloPrescricaoItemDto[];
}

export class AplicarModeloDto {
  @ApiProperty({ description: 'Modelo de prescrição a aplicar na internação' })
  @IsUUID()
  modeloId!: string;
}

// ───────── Parâmetros clínicos (doc 05 §9.5) ─────────

export class RegistrarParametroDto {
  @ApiPropertyOptional({ type: Number, description: 'Peso em kg', example: 4.2 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pesoKg?: number;

  @ApiPropertyOptional({ type: Number, description: 'Temperatura em °C', example: 38.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  temperaturaC?: number;

  @ApiPropertyOptional({ type: Number, description: 'Frequência cardíaca (bpm)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  fc?: number;

  @ApiPropertyOptional({ type: Number, description: 'Frequência respiratória (rpm)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  fr?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  observacao?: string;
}

export class ParametroDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: Number, nullable: true }) pesoKg!: number | null;
  @ApiProperty({ type: Number, nullable: true }) temperaturaC!: number | null;
  @ApiProperty({ type: Number, nullable: true }) fc!: number | null;
  @ApiProperty({ type: Number, nullable: true }) fr!: number | null;
  @ApiProperty({ type: String, nullable: true }) observacao!: string | null;
  @ApiProperty() registradoEm!: string;
}
