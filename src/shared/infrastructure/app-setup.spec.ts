import type { INestApplication } from '@nestjs/common';
import { configureApp } from './app-setup.js';

function createApp(): {
  app: INestApplication;
  enableCors: ReturnType<typeof vi.fn>;
} {
  const enableCors = vi.fn();
  const app = {
    use: vi.fn(),
    enableCors,
    useGlobalPipes: vi.fn(),
    useGlobalFilters: vi.fn(),
  } as unknown as INestApplication;

  return { app, enableCors };
}

describe('configureApp CORS hardening', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalCors = process.env.CORS_ORIGIN;

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalCors === undefined) {
      delete process.env.CORS_ORIGIN;
    } else {
      process.env.CORS_ORIGIN = originalCors;
    }
  });

  it('refuses to start in production without CORS_ORIGIN', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CORS_ORIGIN;

    const { app } = createApp();

    expect(() => configureApp(app, { swagger: false })).toThrow(
      /CORS_ORIGIN must be set in production/,
    );
  });

  it('uses the configured origins in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGIN = 'https://app.example.com, https://admin.example.com';

    const { app, enableCors } = createApp();
    configureApp(app, { swagger: false });

    expect(enableCors).toHaveBeenCalledWith({
      origin: ['https://app.example.com', 'https://admin.example.com'],
      credentials: true,
    });
  });

  it('keeps the localhost defaults outside production', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.CORS_ORIGIN;

    const { app, enableCors } = createApp();
    configureApp(app, { swagger: false });

    expect(enableCors).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: expect.arrayContaining(['http://localhost:4200']),
        credentials: true,
      }),
    );
  });
});
