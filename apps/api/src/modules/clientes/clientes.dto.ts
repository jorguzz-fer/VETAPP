import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateResponsavelDto {
  @ApiProperty({ example: 'Maria Silva' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  nome!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  codigo?: string;

  @ApiPropertyOptional({ example: 'maria@email.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: '+55 11 99999-0000' })
  @IsOptional()
  @IsString()
  telefone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  documento?: string;

  @ApiPropertyOptional({ description: 'Como nos conheceu?' })
  @IsOptional()
  @IsString()
  origem?: string;
}

export class CreateAnimalDto {
  @ApiProperty({ example: 'Rex' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nome!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  codigo?: string;

  @ApiPropertyOptional({ example: 'Canina' })
  @IsOptional()
  @IsString()
  especie?: string;

  @ApiPropertyOptional({ example: 'Labrador' })
  @IsOptional()
  @IsString()
  raca?: string;

  @ApiPropertyOptional({ enum: ['M', 'F'] })
  @IsOptional()
  @IsIn(['M', 'F'])
  sexo?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  castrado?: boolean;

  @ApiPropertyOptional({ example: '2020-05-10', description: 'AAAA-MM-DD' })
  @IsOptional()
  @IsString()
  nascimento?: string;
}

export class ResponsavelDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional({ type: String }) codigo?: string | null;
  @ApiProperty() nome!: string;
  @ApiPropertyOptional({ type: String }) email?: string | null;
  @ApiPropertyOptional({ type: String }) telefone?: string | null;
  @ApiPropertyOptional({ type: String }) documento?: string | null;
  @ApiPropertyOptional({ type: String }) origem?: string | null;
}

export class AnimalDto {
  @ApiProperty() id!: string;
  @ApiProperty() responsavelId!: string;
  @ApiPropertyOptional({ type: String }) codigo?: string | null;
  @ApiProperty() nome!: string;
  @ApiPropertyOptional({ type: String }) especie?: string | null;
  @ApiPropertyOptional({ type: String }) raca?: string | null;
  @ApiPropertyOptional({ type: String }) sexo?: string | null;
  @ApiProperty() castrado!: boolean;
  @ApiPropertyOptional({ type: String }) nascimento?: string | null;
  @ApiProperty() status!: string;
}

export class ResponsavelComAnimaisDto extends ResponsavelDto {
  @ApiProperty({ type: [AnimalDto] })
  animais!: AnimalDto[];
}
