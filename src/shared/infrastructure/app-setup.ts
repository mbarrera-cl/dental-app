import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { DomainExceptionFilter } from './http/domain-exception.filter.js';
import { createOriginGuard } from './http/origin-guard.middleware.js';

export const CORS_ORIGIN_ENV = 'CORS_ORIGIN';

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:4200', // shell
  'http://localhost:4201', // users remote
  'http://localhost:4202', // dashboard remote
  'http://localhost:4203', // patients remote
  'http://localhost:4204', // admin remote
  'http://localhost:4205', // quotes remote
  'http://localhost:4206', // agenda remote
];

function resolveCorsOrigins(): string[] {
  const raw = process.env[CORS_ORIGIN_ENV];

  if (raw === undefined || raw.trim() === '') {
    // Falling back to localhost origins in production would either break the
    // real frontends or, worse, accept the wrong ones silently.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `${CORS_ORIGIN_ENV} must be set in production (comma-separated list of allowed origins)`,
      );
    }

    return DEFAULT_CORS_ORIGINS;
  }

  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export interface AppSetupOptions {
  /**
   * Mount the OpenAPI docs at /docs. Defaults to enabled outside production
   * and disabled in production and e2e tests.
   */
  swagger?: boolean;
}

/**
 * Shared application wiring used by both `main.ts` and the e2e tests, so the
 * tests exercise exactly the same edge configuration as production.
 */
export function configureApp(app: INestApplication, options: AppSetupOptions = {}): void {
  const corsOrigins = resolveCorsOrigins();
  const isProduction = process.env.NODE_ENV === 'production';

  // Baseline hardening. CSP starts in report-only so the microfrontends
  // (import maps, lazy-loaded Shiki/KaTeX/Mermaid) cannot be broken by a
  // directive that is too strict; tighten per environment after observing
  // the reports.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      // The public branding assets are embedded from the frontend origins.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      strictTransportSecurity: isProduction
        ? { maxAge: 15_552_000, includeSubDomains: true }
        : false,
    }),
  );
  app.use(
    helmet.contentSecurityPolicy({
      useDefaults: false,
      reportOnly: true,
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", ...corsOrigins],
        workerSrc: ["'self'", 'blob:'],
      },
    }),
  );

  // Reject state-changing requests whose browser Origin is not allowlisted.
  app.use(createOriginGuard(corsOrigins));

  // The microfrontends run on their own dev-server origins (:4200-:4204).
  // `credentials: true` lets the browser send the httpOnly refresh cookie.
  app.enableCors({ origin: corsOrigins, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new DomainExceptionFilter());

  // Exposing the full route/DTO surface in production is an information leak.
  const swaggerEnabled = options.swagger ?? process.env.NODE_ENV !== 'production';

  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Hexagonal NestJS API')
      .setDescription(
        'Boilerplate API built with NestJS and hexagonal architecture (ports & adapters).',
      )
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
      .addApiKey({ type: 'apiKey', in: 'header', name: 'X-Api-Key' }, 'api-key')
      .build();

    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  }
}
