import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';

export const STATUS_ASSINATURA = ['trial', 'ativa', 'inadimplente', 'suspensa', 'cancelada'] as const;
export const CICLOS = ['mensal', 'anual'] as const;

export class ClinicaResumoDto {
  @ApiProperty() tenantId!: string;
  @ApiProperty() nome!: string;
  @ApiProperty() usuarios!: number;
  @ApiProperty() status!: string;
  @ApiProperty({ type: String, nullable: true }) planoNome!: string | null;
  @ApiProperty() precoCentavos!: number;
  @ApiProperty({ type: String, nullable: true }) vigenteAte!: string | null;
}

export class PlanoDto {
  @ApiProperty() id!: string;
  @ApiProperty() nome!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() precoCentavos!: number;
  @ApiProperty() ciclo!: string;
  @ApiProperty() ativo!: string;
}

export class CriarPlanoDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(60) nome!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(40) slug!: string;
  @ApiProperty({ type: Number }) @IsInt() @Min(0) precoCentavos!: number;
  @ApiProperty({ enum: CICLOS }) @IsIn(CICLOS as unknown as string[]) ciclo!: string;
}

export class AtualizarPlanoDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(60) nome?: string;
  @ApiPropertyOptional({ type: Number }) @IsOptional() @IsInt() @Min(0) precoCentavos?: number;
  @ApiPropertyOptional({ enum: CICLOS }) @IsOptional() @IsIn(CICLOS as unknown as string[]) ciclo?: string;
  @ApiPropertyOptional({ enum: ['true', 'false'] }) @IsOptional() @IsIn(['true', 'false']) ativo?: string;
}

export class AtualizarAssinaturaDto {
  @ApiPropertyOptional({ type: String, nullable: true }) @IsOptional() @IsUUID() planoId?: string;
  @ApiPropertyOptional({ enum: STATUS_ASSINATURA }) @IsOptional() @IsIn(STATUS_ASSINATURA as unknown as string[]) status?: string;
  @ApiPropertyOptional({ description: 'Vigente até (YYYY-MM-DD)' }) @IsOptional() @IsString() vigenteAte?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) observacao?: string;
}

export class ProvisionarClinicaDto {
  @ApiProperty({ example: 'Clínica Bicho Feliz' }) @IsString() @MinLength(2) @MaxLength(120) nome!: string;
  @ApiProperty({ example: 'dono@clinica.com' }) @IsString() @MinLength(3) adminEmail!: string;
  @ApiProperty({ example: 'Dr. Fulano' }) @IsString() @MinLength(2) @MaxLength(120) adminNome!: string;
}

export class ProvisionarClinicaResultDto {
  @ApiProperty() tenantId!: string;
  @ApiProperty() adminUserId!: string;
  @ApiProperty({ description: 'Senha temporária do admin (exibida uma vez)' }) senhaTemporaria!: string;
}

export class AssinaturaDto {
  @ApiProperty() tenantId!: string;
  @ApiProperty({ type: String, nullable: true }) planoId!: string | null;
  @ApiProperty() status!: string;
  @ApiProperty() precoCentavos!: number;
  @ApiProperty() ciclo!: string;
  @ApiProperty({ type: String, nullable: true }) vigenteAte!: string | null;
  @ApiProperty({ type: String, nullable: true }) trialAte!: string | null;
  @ApiProperty({ type: String, nullable: true }) observacao!: string | null;
}

export class KpisDto {
  @ApiProperty() totalClinicas!: number;
  @ApiProperty({ type: Object }) porStatus!: Record<string, number>;
  @ApiProperty() mrrCentavos!: number;
}
