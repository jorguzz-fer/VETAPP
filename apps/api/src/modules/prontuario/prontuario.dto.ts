import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export const TIPOS_EVENTO = [
  'atendimento',
  'peso',
  'vacina',
  'exame',
  'receita',
  'observacao',
  'internacao',
] as const;

export class CreateEventoDto {
  @ApiProperty({ enum: TIPOS_EVENTO })
  @IsIn(TIPOS_EVENTO as unknown as string[])
  tipo!: string;

  @ApiProperty({ example: 'Consulta clínica de rotina' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  descricao!: string;

  @ApiPropertyOptional({ type: Number, description: 'Valor em centavos (ex.: 15000 = R$ 150,00)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  valorCentavos?: number;

  @ApiPropertyOptional({ type: Boolean, default: true, description: 'Gera lançamento na fatura do cliente' })
  @IsOptional()
  @IsBoolean()
  faturar?: boolean;

  @ApiPropertyOptional({ type: String, description: 'Chave de anexo já enviado ao storage (opcional)' })
  @IsOptional()
  @IsString()
  anexoKey?: string;
}

export const ANEXO_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'video/mp4',
] as const;

export class ProntuarioSignUploadDto {
  @ApiProperty({ enum: ANEXO_CONTENT_TYPES })
  @IsIn(ANEXO_CONTENT_TYPES as unknown as string[])
  contentType!: string;
}

export class SignUploadResponseDto {
  @ApiProperty() key!: string;
  @ApiProperty() uploadUrl!: string;
}

export class EventoDto {
  @ApiProperty() id!: string;
  @ApiProperty() animalId!: string;
  @ApiProperty() tipo!: string;
  @ApiProperty() descricao!: string;
  @ApiPropertyOptional({ type: Number }) valorCentavos?: number | null;
  @ApiProperty() data!: string;
  @ApiPropertyOptional({ type: String, description: 'URL assinada (curta) do anexo, se houver' })
  anexoUrl?: string | null;
}

export class FaturaItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() descricao!: string;
  @ApiProperty() valorCentavos!: number;
  @ApiPropertyOptional({ type: String }) eventoId?: string | null;
}

export class FaturaDto {
  @ApiProperty() id!: string;
  @ApiProperty() responsavelId!: string;
  @ApiProperty() status!: string;
  @ApiProperty() totalCentavos!: number;
  @ApiProperty({ type: [FaturaItemDto] }) itens!: FaturaItemDto[];
}
