import { ApiProperty } from '@nestjs/swagger';

// Exportação de dados do titular (LGPD — direito de acesso/portabilidade, doc 09 §5).
// O payload é um retrato agregado; os blocos aninhados são objetos livres (JSON) de
// propósito — é um dump para o titular, não um contrato estável de API.
export class LgpdExportDto {
  @ApiProperty({ description: 'Instante da exportação (ISO)' }) exportadoEm!: string;
  @ApiProperty() responsavelId!: string;
  @ApiProperty({ type: Object, description: 'Cadastro do responsável (titular)' })
  responsavel!: Record<string, unknown>;
  @ApiProperty({ type: [Object], description: 'Animais + prontuário de cada um' })
  animais!: Record<string, unknown>[];
  @ApiProperty({ type: [Object], description: 'Faturas + itens + recebimentos' })
  faturas!: Record<string, unknown>[];
  @ApiProperty({ type: [Object], description: 'Agendamentos' })
  agendamentos!: Record<string, unknown>[];
}
