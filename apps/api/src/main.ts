import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import type { EnvConfig } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const env = app.get<EnvConfig>('ENV');

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: env.CORS_ORIGINS, credentials: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // OpenAPI como fonte de verdade (docs/spec/11). Em prod, restringir o acesso.
  const config = new DocumentBuilder()
    .setTitle('VETAPP API')
    .setDescription('API do VETAPP — versionada (/api/v1 nas próximas iterações)')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(env.API_PORT);
  // eslint-disable-next-line no-console
  console.log(`VETAPP API ouvindo em http://localhost:${env.API_PORT} (docs em /api/docs)`);
}

bootstrap();
