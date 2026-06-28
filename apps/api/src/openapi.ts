import 'reflect-metadata';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { swaggerConfig } from './openapi.config';

// Emissor do spec OpenAPI → packages/api-client/openapi.json (fonte de verdade do
// cliente gerado). Não precisa de banco: postgres.js conecta de forma preguiçosa.
// Fallbacks garantem que a validação de env não bloqueie a geração offline.
process.env.NODE_ENV ||= 'development';
process.env.DATABASE_URL ||= 'postgresql://user:pass@localhost:5432/vetapp';
process.env.JWT_ACCESS_SECRET ||= 'openapi-gen-access-secret';
process.env.JWT_REFRESH_SECRET ||= 'openapi-gen-refresh-secret';

async function main(): Promise<void> {
  // Import tardio para os fallbacks acima valerem antes da validação de env.
  const { AppModule } = await import('./app.module');
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  const out = resolve(__dirname, '../../../packages/api-client/openapi.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(document, null, 2));
  await app.close();
  // eslint-disable-next-line no-console
  console.log('OpenAPI escrito em', out);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
