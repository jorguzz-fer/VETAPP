import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAgendamentoDto {
  @ApiProperty({ example: 'Consulta — Rex' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  titulo!: string;

  @ApiProperty({ example: '2026-07-01T14:00:00Z', description: 'ISO 8601' })
  @IsDateString()
  inicio!: string;

  @ApiPropertyOptional({
    example: '2026-07-01T14:30:00Z',
    description: 'ISO 8601. Opcional com tipoAtendimentoId (usa a duração do tipo).',
  })
  @IsOptional()
  @IsDateString()
  fim?: string;

  @ApiPropertyOptional({ type: String, description: 'Tipo de atendimento (define duração/cor)' })
  @IsOptional()
  @IsUUID()
  tipoAtendimentoId?: string;

  @ApiPropertyOptional({ type: String, description: 'Profissional responsável (membro do tenant)' })
  @IsOptional()
  @IsUUID()
  profissionalId?: string;

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
  @MaxLength(500)
  observacoes?: string;
}

export class UpdateStatusDto {
  @ApiProperty({ enum: ['agendado', 'confirmado', 'concluido', 'faltou', 'cancelado'] })
  @IsIn(['agendado', 'confirmado', 'concluido', 'faltou', 'cancelado'])
  status!: string;
}

export class AgendamentoDto {
  @ApiProperty() id!: string;
  @ApiProperty() titulo!: string;
  @ApiProperty() inicio!: string;
  @ApiProperty() fim!: string;
  @ApiProperty() status!: string;
  @ApiPropertyOptional({ type: String }) tipoAtendimentoId?: string | null;
  @ApiPropertyOptional({ type: String }) tipoNome?: string | null;
  @ApiPropertyOptional({ type: String }) cor?: string | null;
  @ApiPropertyOptional({ type: String }) profissionalId?: string | null;
  @ApiPropertyOptional({ type: String }) profissionalNome?: string | null;
  @ApiPropertyOptional({ type: String }) animalId?: string | null;
  @ApiPropertyOptional({ type: String }) responsavelId?: string | null;
  @ApiPropertyOptional({ type: String }) observacoes?: string | null;
}

export class ProfissionalDto {
  @ApiProperty() userId!: string;
  @ApiProperty() nome!: string;
  @ApiProperty() role!: string;
}

export class CreateTipoAtendimentoDto {
  @ApiProperty({ example: 'Consulta' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nome!: string;

  @ApiPropertyOptional({ type: Number, example: 30, description: 'Duração padrão em minutos' })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  duracaoMinutos?: number;

  @ApiPropertyOptional({ example: '#7c5cff', description: 'Cor do evento na agenda (hex)' })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  cor?: string;
}

export class UpdateTipoAtendimentoDto {
  @ApiPropertyOptional({ example: 'Consulta' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nome?: string;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  duracaoMinutos?: number;

  @ApiPropertyOptional({ example: '#7c5cff' })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  cor?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class TipoAtendimentoDto {
  @ApiProperty() id!: string;
  @ApiProperty() nome!: string;
  @ApiProperty() duracaoMinutos!: number;
  @ApiProperty({ type: String, nullable: true }) cor!: string | null;
  @ApiProperty() ativo!: boolean;
}
