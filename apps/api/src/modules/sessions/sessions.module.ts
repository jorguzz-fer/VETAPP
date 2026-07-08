import { Global, Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';

// @Global: SessionsService injetável em qualquer módulo (ex.: usuários → revogar
// sessões ao resetar senha/desativar). Também roda a limpeza periódica de tokens.
@Global()
@Module({
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
