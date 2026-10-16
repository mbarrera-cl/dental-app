import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { DomainExceptionFilter } from './http/domain-exception.filter.js';

export const CORS_ORIGIN_ENV = 'CORS_ORIGIN';

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:4200', // shell
  'http://localhost:4201', // users remote
  'http://localhost:4202', // dashboard remote
];

function resolveCorsOrigins(): string[] {
  const raw = process.env[CORS_ORIGIN_ENV];

  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_CORS_ORIGINS;
  }

  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export interface AppSetupOptions {
  /** Mount the OpenAPI docs at /docs. Enabled by default, disabled in e2e tests. */
  swagger?: boolean;
}

/**
 * Shared application wiring used by both `main.ts` and the e2e tests, so the
 * tests exercise exactly the same edge configuration as production.
 */
export function configureApp(app: INestApplication, options: AppSetupOptions = {}): void {
  // The microfrontends run on their own dev-server origins (:4200-:4202).
  app.enableCors({ origin: resolveCorsOrigins() });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new DomainExceptionFilter());

  if (options.swagger !== false) {
    const config = new DocumentBuilder()
      .setTitle('Hexagonal NestJS API')
      .setDescription(
        'Boilerplate API built with NestJS and hexagonal architecture (ports & adapters).',
      )
      .setVersion('1.0')
      .build();

    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  }
}
