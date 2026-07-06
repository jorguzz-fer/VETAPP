import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { swaggerConfig } from './openapi.config';
import type { EnvConfig } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const env = app.get<EnvConfig>('ENV');

  // Atrás de proxy reverso (Coolify/Traefik): confia no 1º proxy para que req.ip
  // reflita o X-Forwarded-For real — o rate limiting precisa da IP do cliente,
  // não a do proxy (senão todos compartilhariam a mesma chave de limite).
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: env.CORS_ORIGINS, credentials: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // OpenAPI como fonte de verdade (docs/spec/11). Em produção o endpoint vivo fica
  // DESABILITADO — nenhuma rota a mais exposta (doc 02). O contrato continua gerado
  // offline por `openapi:gen`; para expor a parceiros, publicar atrás de proxy/authz.
  const docsEnabled = env.NODE_ENV !== 'production';
  if (docsEnabled) {
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));
  }

  await app.listen(env.API_PORT);
  // eslint-disable-next-line no-console
  console.log(
    `VETAPP API ouvindo em http://localhost:${env.API_PORT}` +
      (docsEnabled ? ' (docs em /api/docs)' : ' (docs desabilitados em produção)'),
  );
}

bootstrap();
