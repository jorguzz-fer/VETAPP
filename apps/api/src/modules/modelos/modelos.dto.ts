import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

const TIPOS = ['receita', 'documento'] as const;

export class ModeloDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: TIPOS }) tipo!: string;
  @ApiProperty() nome!: string;
  @ApiProperty() conteudo!: string;
}

export class CreateModeloDto {
  @ApiProperty({ enum: TIPOS })
  @IsIn(TIPOS)
  tipo!: string;

  @ApiProperty({ example: 'Receita simples' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  nome!: string;

  @ApiProperty({ description: 'Placeholders: {{animal}} {{especie}} {{raca}} {{tutor}} {{telefone}} {{data}} {{clinica}}' })
  @IsString()
  @IsNotEmpty()
  conteudo!: string;
}

export class UpdateModeloDto {
  @ApiPropertyOptional({ enum: TIPOS }) @IsOptional() @IsIn(TIPOS) tipo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) nome?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() conteudo?: string;
}

export class GerarModeloDto {
  @ApiProperty({ description: 'Animal para preencher os placeholders' })
  @IsUUID()
  animalId!: string;
}

export class ModeloGeradoDto {
  @ApiProperty() titulo!: string;
  @ApiProperty() conteudo!: string;
}
