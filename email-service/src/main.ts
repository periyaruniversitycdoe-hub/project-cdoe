import { NestFactory }      from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService }    from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { WinstonModule, WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule }        from './app.module';
import { createWinstonOptions } from './common/logger/winston.logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Use Winston from the start so startup logs are structured
    logger: WinstonModule.createLogger(createWinstonOptions()),
    bufferLogs: true,
  });

  const config = app.get(ConfigService);
  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);

  app.useLogger(logger);

  // ── Routing ──────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');
  app.enableVersioning({ type: VersioningType.URI });

  // ── Validation ───────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:            true,
      forbidNonWhitelisted: true,
      transform:            true,
      transformOptions:     { enableImplicitConversion: true },
    }),
  );

  // ── CORS ─────────────────────────────────────────────────────
  app.enableCors({
    origin:      config.get<string>('app.frontendUrl'),
    methods:     ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // ── Swagger (only in non-production) ────────────────────────
  if (config.get<string>('app.nodeEnv') !== 'production') {
    const swaggerCfg = new DocumentBuilder()
      .setTitle('Periyar University ERP — Email Module API')
      .setDescription(
        'Production-level email service: registration, email verification, BullMQ background jobs, audit logging.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Registration & email verification')
      .build();

    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(app, swaggerCfg),
    );
  }

  // ── Start ────────────────────────────────────────────────────
  const port    = config.get<number>('app.port', 3000);
  const appName = config.get<string>('app.name', 'ERP Email Service');

  await app.listen(port);

  logger.log(
    `🚀 ${appName} running → http://localhost:${port}/api/v1`,
    'Bootstrap',
  );

  if (config.get<string>('app.nodeEnv') !== 'production') {
    logger.log(
      `📖 Swagger docs → http://localhost:${port}/api/docs`,
      'Bootstrap',
    );
  }
}

bootstrap();
