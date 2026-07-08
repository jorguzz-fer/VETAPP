import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export const CANAIS = ['whatsapp', 'email', 'sms', 'manual'] as const;

export class CreateMensagemDto {
  @ApiProperty({ enum: CANAIS })
  @IsIn(CANAIS as unknown as string[])
  canal!: string;

  @ApiPropertyOptional({ description: 'Assunto (e-mail)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  assunto?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  corpo!: string;

  @ApiPropertyOptional({ description: 'Origem do disparo (ex.: vacina, agendamento)' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  referenciaTipo?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  referenciaId?: string;

  @ApiPropertyOptional({ type: String, description: 'Template usado (opcional)' })
  @IsOptional()
  @IsUUID()
  templateId?: string;
}

// Vacinas a vencer (doc 17 slice 3) — base do lembrete de vacina.
export class VacinaVencendoDto {
  @ApiProperty() vacinaId!: string;
  @ApiProperty() animalId!: string;
  @ApiProperty() animalNome!: string;
  @ApiProperty() responsavelId!: string;
  @ApiProperty() responsavelNome!: string;
  @ApiProperty() vacina!: string;
  @ApiProperty() proximaEm!: string;
  @ApiProperty({ description: 'Dias até a próxima dose (negativo = vencida)' }) diasRestantes!: number;
}

export class MensagemTemplateDto {
  @ApiProperty() id!: string;
  @ApiProperty() nome!: string;
  @ApiProperty() canal!: string;
  @ApiPropertyOptional({ type: String }) assunto?: string | null;
  @ApiProperty() corpo!: string;
  @ApiProperty() ativo!: boolean;
}

export class CreateTemplateDto {
  @ApiProperty({ example: 'Lembrete de vacina' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nome!: string;

  @ApiProperty({ enum: CANAIS })
  @IsIn(CANAIS as unknown as string[])
  canal!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  assunto?: string;

  @ApiProperty({ description: 'Placeholders: {{cliente}}, {{pet}}, {{vacina}}, {{data}}' })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  corpo!: string;
}

export class UpdateTemplateDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(80) nome?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) assunto?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(4000) corpo?: string;
  @ApiPropertyOptional({ type: Boolean }) @IsOptional() @IsBoolean() ativo?: boolean;
}

export class MensagemDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional({ type: String }) responsavelId?: string | null;
  @ApiPropertyOptional({ type: String }) responsavelNome?: string | null;
  @ApiProperty() canal!: string;
  @ApiProperty() direcao!: string;
  @ApiPropertyOptional({ type: String }) assunto?: string | null;
  @ApiProperty() corpo!: string;
  @ApiProperty() status!: string;
  @ApiPropertyOptional({ type: String }) referenciaTipo?: string | null;
  @ApiPropertyOptional({ type: String }) disparadoPorNome?: string | null;
  @ApiProperty() criadaEm!: string;
}
