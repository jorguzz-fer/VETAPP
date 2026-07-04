import { ApiProperty } from '@nestjs/swagger';

export class ProximoAgendamentoDto {
  @ApiProperty() id!: string;
  @ApiProperty() titulo!: string;
  @ApiProperty() inicio!: string;
  @ApiProperty({ type: String, nullable: true }) profissionalNome!: string | null;
  @ApiProperty({ type: String, nullable: true }) cor!: string | null;
}

// Superset por persona (doc 05 §1): o front decide o que exibir pelo papel.
export class DashboardDto {
  @ApiProperty() agendamentosHoje!: number;
  @ApiProperty() minhaAgendaHoje!: number;
  @ApiProperty({ type: [ProximoAgendamentoDto] }) proximos!: ProximoAgendamentoDto[];
  @ApiProperty() internados!: number;
  @ApiProperty() execucoesPendentes!: number;
  @ApiProperty() faturasAbertas!: number;
  @ApiProperty() faturasAbertasCentavos!: number;
  @ApiProperty() receitaMesCentavos!: number;
  @ApiProperty() estoqueAbaixoMinimo!: number;
  @ApiProperty() orcamentosAbertos!: number;
  @ApiProperty() clientes!: number;
  @ApiProperty() minhasComissoesMesCentavos!: number;
}
