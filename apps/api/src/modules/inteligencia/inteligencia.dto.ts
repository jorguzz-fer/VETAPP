import { ApiProperty } from '@nestjs/swagger';

export class ProdutividadeDto {
  @ApiProperty() userId!: string;
  @ApiProperty() nome!: string;
  @ApiProperty({ description: 'Lançamentos faturados atribuídos ao colaborador' }) lancamentos!: number;
  @ApiProperty({ description: 'Receita gerada (centavos)' }) receitaCentavos!: number;
  @ApiProperty({ description: 'Agendamentos concluídos no período' }) agendamentosConcluidos!: number;
}
