import { DocumentBuilder } from '@nestjs/swagger';

// Config única do OpenAPI, reusada pelo servidor (main.ts) e pelo emissor do
// spec (openapi.ts → packages/api-client/openapi.json).
export const swaggerConfig = new DocumentBuilder()
  .setTitle('VETAPP API')
  .setDescription('API do VETAPP — versionada (/api/v1 nas próximas iterações)')
  .setVersion('0.1.0')
  .addBearerAuth()
  .build();
