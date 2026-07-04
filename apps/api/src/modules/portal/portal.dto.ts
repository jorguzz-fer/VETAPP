import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

// ───────── Auth do tutor ─────────

export class PortalLoginDto {
  @ApiProperty({ description: 'Tenant (clínica) do portal — o front guarda do convite' })
  @IsUUID()
  tenantId!: string;

  @ApiProperty({ example: 'tutor@email.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'senha-forte-aqui' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class PortalAcceptInviteDto {
  @ApiProperty({ description: 'Token do link de convite' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ example: 'senha-forte-aqui', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;
}

export class PortalRefreshDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class PortalLogoutDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class PortalTokensDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty({ description: 'Tenant do tutor — o front guarda p/ o próximo login' })
  tenantId!: string;
}

export class PortalInvitePreviewDto {
  @ApiProperty()
  responsavelNome!: string;

  @ApiProperty()
  clinicaNome!: string;

  @ApiProperty({ type: String, nullable: true })
  email!: string | null;
}

export class PortalMeDto {
  @ApiProperty()
  responsavelId!: string;

  @ApiProperty()
  nome!: string;

  @ApiProperty({ type: String, nullable: true })
  email!: string | null;

  @ApiProperty()
  clinicaNome!: string;
}

export class OkDto {
  @ApiProperty()
  ok!: boolean;
}

// ───────── Dados do tutor ─────────

export class PortalPetDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  nome!: string;

  @ApiProperty({ type: String, nullable: true })
  especie!: string | null;

  @ApiProperty({ type: String, nullable: true })
  raca!: string | null;

  @ApiProperty({ type: String, nullable: true })
  sexo!: string | null;

  @ApiProperty()
  castrado!: boolean;

  @ApiProperty({ type: String, nullable: true })
  nascimento!: string | null;

  @ApiProperty()
  status!: string;

  @ApiProperty({ type: String, nullable: true, description: 'URL assinada da foto (curta validade)' })
  fotoUrl!: string | null;
}

export class PortalVacinaDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  descricao!: string;

  @ApiProperty()
  data!: string;
}

export class PortalHistoricoDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'atendimento | vacina | exame | receita | internacao | peso' })
  tipo!: string;

  @ApiProperty()
  descricao!: string;

  @ApiProperty()
  data!: string;
}

export class PortalPetDetalheDto {
  @ApiProperty({ type: PortalPetDto })
  pet!: PortalPetDto;

  @ApiProperty({ type: [PortalVacinaDto] })
  vacinas!: PortalVacinaDto[];

  @ApiProperty({ type: [PortalHistoricoDto] })
  historico!: PortalHistoricoDto[];
}

export class PortalAgendamentoDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  titulo!: string;

  @ApiProperty({ type: String, nullable: true })
  petNome!: string | null;

  @ApiProperty({ type: String, nullable: true })
  tipoNome!: string | null;

  @ApiProperty({ type: String, nullable: true })
  profissionalNome!: string | null;

  @ApiProperty()
  inicio!: string;

  @ApiProperty()
  fim!: string;

  @ApiProperty()
  status!: string;
}

export class PortalFaturaResumoDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  totalCentavos!: number;

  @ApiProperty()
  recebidoCentavos!: number;

  @ApiProperty()
  saldoCentavos!: number;

  @ApiProperty()
  criadaEm!: string;
}

export class PortalFaturaItemDto {
  @ApiProperty()
  descricao!: string;

  @ApiProperty()
  valorCentavos!: number;
}

export class PortalFaturaDetalheDto {
  @ApiProperty({ type: PortalFaturaResumoDto })
  fatura!: PortalFaturaResumoDto;

  @ApiProperty({ type: [PortalFaturaItemDto] })
  itens!: PortalFaturaItemDto[];
}

// ───────── Admin (clínica gerencia o acesso) ─────────

export class PortalAcessoDto {
  @ApiProperty({ description: 'sem-acesso | invited | active | disabled' })
  status!: string;

  @ApiProperty({ type: String, nullable: true })
  email!: string | null;

  @ApiProperty({ type: String, nullable: true })
  inviteExpiresAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  lastLoginAt!: string | null;
}

export class PortalConviteResponseDto {
  @ApiProperty({ description: 'Token do convite — a clínica envia o link ao tutor' })
  token!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  expiresAt!: string;
}
