import { ApiProperty } from '@nestjs/swagger';

export class FaturaResumoDto {
  @ApiProperty() id!: string;
  @ApiProperty() responsavelId!: string;
  @ApiProperty() responsavelNome!: string;
  @ApiProperty() status!: string; // aberta | paga | cancelada
  @ApiProperty() totalCentavos!: number;
  @ApiProperty() itens!: number;
  @ApiProperty() criadaEm!: string;
}

export class OkDto {
  @ApiProperty() ok!: boolean;
}
