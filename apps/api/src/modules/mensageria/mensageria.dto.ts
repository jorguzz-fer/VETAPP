import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

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
