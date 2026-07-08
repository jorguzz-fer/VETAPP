import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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

  @ApiPropertyOptional({ example: 'Preto e marrom' })
  @IsOptional()
  @IsString()
  pelagem?: string;

  @ApiPropertyOptional({ description: 'Número do microchip' })
  @IsOptional()
  @IsString()
  microchip?: string;

  @ApiPropertyOptional({ type: [String], description: 'Marcações/tags clínicas (ex.: renal)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  marcacoes?: string[];

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  pedigree?: boolean;

  @ApiPropertyOptional({ description: 'Número do pedigree' })
  @IsOptional()
  @IsString()
  pedigreeNumero?: string;
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
  @ApiPropertyOptional({ type: String }) pelagem?: string | null;
  @ApiPropertyOptional({ type: String }) sexo?: string | null;
  @ApiProperty() castrado!: boolean;
  @ApiPropertyOptional({ type: String }) nascimento?: string | null;
  @ApiPropertyOptional({ type: String }) microchip?: string | null;
  @ApiProperty({ type: [String] }) marcacoes!: string[];
  @ApiProperty() pedigree!: boolean;
  @ApiPropertyOptional({ type: String }) pedigreeNumero?: string | null;
  @ApiProperty() status!: string;
  @ApiPropertyOptional({ type: String, description: 'URL assinada (curta) da foto, se houver' })
  fotoUrl?: string | null;
}

// Resumo de vendas do cliente para a ficha (doc 16 F1).
export class ClienteVendasResumoDto {
  @ApiProperty() totalVendidoCentavos!: number;
  @ApiProperty() ticketMedioCentavos!: number;
  @ApiProperty() vendas!: number;
  @ApiPropertyOptional({ type: String }) ultimaVendaEm?: string | null;
}

export class ResponsavelComAnimaisDto extends ResponsavelDto {
  @ApiProperty({ type: [AnimalDto] })
  animais!: AnimalDto[];

  @ApiProperty({ type: ClienteVendasResumoDto })
  vendas!: ClienteVendasResumoDto;
}

// Resultado da busca de paciente (prontuário): animal + tutor, para abrir a ficha.
export class BuscaAnimalDto {
  @ApiProperty() id!: string;
  @ApiProperty() nome!: string;
  @ApiPropertyOptional({ type: String }) especie?: string | null;
  @ApiPropertyOptional({ type: String }) raca?: string | null;
  @ApiProperty() status!: string;
  @ApiProperty() responsavelId!: string;
  @ApiProperty() responsavelNome!: string;
}

export class UpdateResponsavelDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(160) nome?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() codigo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() telefone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() documento?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() origem?: string;
}

export class UpdateAnimalDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(120) nome?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() codigo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() especie?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() raca?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() pelagem?: string;
  @ApiPropertyOptional({ enum: ['M', 'F'] }) @IsOptional() @IsIn(['M', 'F']) sexo?: string;
  @ApiPropertyOptional({ type: Boolean }) @IsOptional() @IsBoolean() castrado?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() nascimento?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() microchip?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) marcacoes?: string[];
  @ApiPropertyOptional({ type: Boolean }) @IsOptional() @IsBoolean() pedigree?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() pedigreeNumero?: string;
  @ApiPropertyOptional({ enum: ['vivo', 'falecido'] }) @IsOptional() @IsIn(['vivo', 'falecido']) status?: string;
}

// Pet resumido para a listagem de clientes (doc 16 C4): tutor + pacientes na linha.
export class ResponsavelPetResumoDto {
  @ApiProperty() id!: string;
  @ApiProperty() nome!: string;
  @ApiPropertyOptional({ type: String }) codigo?: string | null;
}

export class ResponsavelListItemDto extends ResponsavelDto {
  @ApiProperty({ type: [ResponsavelPetResumoDto] }) pets!: ResponsavelPetResumoDto[];
}

export class ListResponsaveisDto {
  @ApiProperty({ type: [ResponsavelListItemDto] }) items!: ResponsavelListItemDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

export class OkDto {
  @ApiProperty() ok!: boolean;
}

export class SignUploadDto {
  @ApiProperty({ example: 'image/jpeg', enum: ['image/jpeg', 'image/png', 'image/webp'] })
  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  contentType!: string;
}

export class SignUploadResponseDto {
  @ApiProperty({ description: 'Chave do objeto a confirmar depois do upload' })
  key!: string;

  @ApiProperty({ description: 'URL pré-assinada para PUT direto no storage (curta validade)' })
  uploadUrl!: string;
}

export class ConfirmFotoDto {
  @ApiProperty()
  @IsString()
  key!: string;
}
