import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateAgendamentoDto {
  @ApiProperty({ example: 'Consulta — Rex' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  titulo!: string;

  @ApiProperty({ example: '2026-07-01T14:00:00Z', description: 'ISO 8601' })
  @IsDateString()
  inicio!: string;

  @ApiProperty({ example: '2026-07-01T14:30:00Z', description: 'ISO 8601' })
  @IsDateString()
  fim!: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  animalId?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  responsavelId?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  observacoes?: string;
}

export class AgendamentoDto {
  @ApiProperty() id!: string;
  @ApiProperty() titulo!: string;
  @ApiProperty() inicio!: string;
  @ApiProperty() fim!: string;
  @ApiProperty() status!: string;
  @ApiPropertyOptional({ type: String }) animalId?: string | null;
  @ApiPropertyOptional({ type: String }) responsavelId?: string | null;
  @ApiPropertyOptional({ type: String }) observacoes?: string | null;
}
