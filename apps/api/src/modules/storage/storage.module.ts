import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';

// Global: StorageService injetável em qualquer módulo (ex.: clientes → foto do animal).
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
