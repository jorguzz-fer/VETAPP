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
  // Receita líquida do mês (doc 16 D2): recebido no mês, líquido da taxa da forma.
  @ApiProperty() receitaLiquidaMesCentavos!: number;
  // Ticket médio do mês (doc 16 D4): média das faturas não canceladas do mês.
  @ApiProperty() ticketMedioCentavos!: number;
  // Faturas a receber (doc 16 D5): saldo em aberto (total − recebido), não canceladas/pagas.
  @ApiProperty() aReceberCentavos!: number;
  @ApiProperty() orcamentosAbertos!: number;
  @ApiProperty() clientes!: number;
  @ApiProperty() minhasComissoesMesCentavos!: number;
}
