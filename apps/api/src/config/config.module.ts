import { Global, Module } from '@nestjs/common';
import { loadEnv, type EnvConfig } from './env';

// Provider 'ENV' com a config validada, injetável em qualquer serviço.
@Global()
@Module({
  providers: [
    {
      provide: 'ENV',
      useFactory: (): EnvConfig => loadEnv(),
    },
  ],
  exports: ['ENV'],
})
export class ConfigModule {}
