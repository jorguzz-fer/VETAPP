import { ApiProperty } from '@nestjs/swagger';

export class AuditLogItemDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: String, nullable: true }) userId!: string | null;
  @ApiProperty({ type: String, nullable: true }) userNome!: string | null;
  @ApiProperty() acao!: string;
  @ApiProperty() entidade!: string;
  @ApiProperty({ type: String, nullable: true }) entidadeId!: string | null;
  @ApiProperty() resumo!: string;
  @ApiProperty({ type: Object, nullable: true }) detalhe!: Record<string, unknown> | null;
  @ApiProperty({ type: String, nullable: true }) ip!: string | null;
  @ApiProperty() criadoEm!: string;
}

export class AuditLogPageDto {
  @ApiProperty({ type: [AuditLogItemDto] }) items!: AuditLogItemDto[];
  @ApiProperty({ description: 'Total de registros que casam o filtro' }) total!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() offset!: number;
}
