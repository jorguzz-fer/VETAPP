import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export const TIPOS_ITEM = ['produto', 'servico', 'exame', 'vacina', 'medicamento', 'cirurgia'] as const;

export class CreateItemDto {
  @ApiProperty({ example: '22', description: 'Código único do item no tenant' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  codigo!: string;

  @ApiProperty({ example: 'Avaliação cirúrgica' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nome!: string;

  @ApiProperty({ enum: TIPOS_ITEM })
  @IsIn(TIPOS_ITEM as unknown as string[])
  tipo!: string;

  @ApiProperty({ type: Number, example: 15000, description: 'Preço em centavos' })
  @IsInt()
  @Min(0)
  precoCentavos!: number;
}

export class UpdateItemDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(40) codigo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(200) nome?: string;
  @ApiPropertyOptional({ enum: TIPOS_ITEM }) @IsOptional() @IsIn(TIPOS_ITEM as unknown as string[]) tipo?: string;
  @ApiPropertyOptional({ type: Number }) @IsOptional() @IsInt() @Min(0) precoCentavos?: number;
  @ApiPropertyOptional({ type: Boolean }) @IsOptional() @IsBoolean() ativo?: boolean;
}

export class ItemCatalogoDto {
  @ApiProperty() id!: string;
  @ApiProperty() codigo!: string;
  @ApiProperty() nome!: string;
  @ApiProperty() tipo!: string;
  @ApiProperty() precoCentavos!: number;
  @ApiProperty() ativo!: boolean;
}

export class PrecoHistoricoDto {
  @ApiProperty() id!: string;
  @ApiProperty() precoCentavos!: number;
  @ApiProperty({ description: 'Vigente a partir de (ISO)' }) vigenteDesde!: string;
  @ApiProperty({ type: String, nullable: true }) alteradoPor!: string | null;
  @ApiProperty({ type: String, nullable: true }) alteradoPorNome!: string | null;
}
