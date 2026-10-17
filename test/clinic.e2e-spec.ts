import { Test, TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import sharp from 'sharp';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/shared/infrastructure/app-setup.js';
import { SqliteDatabase } from './../src/shared/infrastructure/database/sqlite-database.js';
import { clearE2eAdminCredentials, loginAsAdmin, useE2eAdminCredentials } from './helpers/auth.js';

interface BrandingBody {
  name: string;
  slogan: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  colors: { primary: string; accent: string; mode: string };
  version: number;
}

interface UploadedVariant {
  variant: string;
  mime: string;
  width: number;
  height: number;
  size: number;
  hash: string;
  url: string;
}

interface UploadBody {
  version: number;
  variants: UploadedVariant[];
}

const pngOf = (width: number, height: number, color = { r: 20, g: 120, b: 200 }): Promise<Buffer> =>
  sharp({ create: { width, height, channels: 4, background: { ...color, alpha: 1 } } })
    .png()
    .toBuffer();

/**
 * Clinic identity end to end: the public branding payload with its ETag, the
 * logo pipeline (variants, versions, rollback), the immutable asset stream
 * and every rejection path (400/413/415) plus permissions.
 */
describe('Clinic branding and logo (e2e)', () => {
  let app: INestApplication<App>;
  let database: SqliteDatabase;
  /** `Bearer <access token>` of the bootstrap administrator. */
  let authorization: string;

  beforeEach(async () => {
    useE2eAdminCredentials();
    database = new SqliteDatabase(':memory:');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SqliteDatabase)
      .useValue(database)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app, { swagger: false });
    await app.init();

    authorization = await loginAsAdmin(app);
  });

  afterEach(async () => {
    await app.close();
    database.onModuleDestroy();
    clearE2eAdminCredentials();
  });

  const getBranding = (etag?: string) => {
    const call = request(app.getHttpServer()).get('/clinic/branding');

    return etag === undefined ? call : call.set('If-None-Match', etag);
  };

  const uploadLogo = (bytes: Buffer, filename = 'logo.png', token = authorization) =>
    request(app.getHttpServer())
      .post('/clinic/logo')
      .set('Authorization', token)
      .attach('file', bytes, filename);

  const removeLogo = (token = authorization) =>
    request(app.getHttpServer()).delete('/clinic/logo').set('Authorization', token);

  const getAsset = (variant: string) =>
    request(app.getHttpServer()).get(`/clinic/assets/${variant}`);

  /** Creates a user with `permissions` as direct grants; returns its bearer token. */
  const createUserWithPermissions = async (email: string, permissions: string[]): Promise<string> => {
    const created = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', authorization)
      .send({ email, name: 'Regular User', password: 'User-Pass-123!' })
      .expect(201);

    const id = (created.body as { id: string }).id;

    await request(app.getHttpServer())
      .put(`/users/${id}/permissions`)
      .set('Authorization', authorization)
      .send({ permissions })
      .expect(200);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'User-Pass-123!' })
      .expect(200);

    return `Bearer ${(login.body as { accessToken: string }).accessToken}`;
  };

  it('serves the branding defaults without authentication', async () => {
    const response = await getBranding().expect(200);
    const branding = response.body as BrandingBody;

    expect(branding).toMatchObject({
      name: 'Mi clínica',
      slogan: '',
      logoUrl: null,
      faviconUrl: null,
      version: 0,
      colors: { primary: '#0284c7', accent: '#f59e0b', mode: 'auto' },
    });
    expect(response.headers['cache-control']).toBe('no-cache');
    expect(response.headers.etag).toBeTruthy();
  });

  it('revalidates with ETag: 304 while nothing changed, 200 when it did', async () => {
    const first = await getBranding().expect(200);
    const etag = first.headers.etag as string;

    await getBranding(etag).expect(304);

    await request(app.getHttpServer())
      .patch('/settings')
      .set('Authorization', authorization)
      .send({ values: { 'clinic.name': 'Clínica Los Andes' } })
      .expect(200);

    const stale = await getBranding(etag).expect(200);
    expect((stale.body as BrandingBody).name).toBe('Clínica Los Andes');
    expect(stale.headers.etag).not.toBe(etag);
  });

  it('reflects identity and color changes immediately', async () => {
    await request(app.getHttpServer())
      .patch('/settings')
      .set('Authorization', authorization)
      .send({
        values: {
          'clinic.name': 'Clínica Los Andes',
          'clinic.slogan': 'Odontología familiar',
          'clinic.theme.primary': '#112233',
          'clinic.theme.mode': 'light',
        },
      })
      .expect(200);

    const branding = (await getBranding().expect(200)).body as BrandingBody;

    expect(branding).toMatchObject({
      name: 'Clínica Los Andes',
      slogan: 'Odontología familiar',
      colors: { primary: '#112233', accent: '#f59e0b', mode: 'light' },
    });
  });

  it('uploads a logo: derives every variant and streams them immutably', async () => {
    const uploaded = (await uploadLogo(await pngOf(800, 400)).expect(201)).body as UploadBody;

    expect(uploaded.version).toBe(1);
    expect(uploaded.variants).toHaveLength(4);

    const variants = new Map(uploaded.variants.map((variant) => [variant.variant, variant]));

    expect(variants.get('logo')).toMatchObject({ mime: 'image/webp', width: 512, height: 256 });
    expect(variants.get('print')).toMatchObject({ mime: 'image/webp', width: 800, height: 400 });
    expect(variants.get('square')).toMatchObject({ mime: 'image/webp', width: 256, height: 256 });
    expect(variants.get('favicon')).toMatchObject({ mime: 'image/png', width: 48, height: 48 });

    const favicon = variants.get('favicon')!;

    const asset = await getAsset('favicon').expect(200);

    expect(asset.headers['content-type']).toContain('image/png');
    expect(asset.headers['cache-control']).toContain('immutable');
    expect(asset.headers['x-content-type-options']).toBe('nosniff');
    expect(asset.body.length).toBe(favicon.size);

    const branding = (await getBranding().expect(200)).body as BrandingBody;

    expect(branding.version).toBe(1);
    expect(branding.logoUrl).toBe(variants.get('logo')!.url);
    expect(branding.faviconUrl).toBe(favicon.url);
  });

  it('replaces the logo and rolls back version by version on DELETE', async () => {
    const first = (await uploadLogo(await pngOf(300, 300, { r: 200, g: 30, b: 90 })).expect(201))
      .body as UploadBody;
    const second = (await uploadLogo(await pngOf(300, 300, { r: 20, g: 180, b: 90 })).expect(201))
      .body as UploadBody;

    expect(first.version).toBe(1);
    expect(second.version).toBe(2);

    const beforeRemoval = (await getBranding().expect(200)).body as BrandingBody;
    expect(beforeRemoval.version).toBe(2);
    expect(beforeRemoval.logoUrl).toBe(second.variants.find((v) => v.variant === 'logo')!.url);

    await removeLogo().expect(200, { version: 1 });

    const rolledBack = (await getBranding().expect(200)).body as BrandingBody;
    expect(rolledBack.version).toBe(1);
    expect(rolledBack.logoUrl).toBe(first.variants.find((v) => v.variant === 'logo')!.url);

    await removeLogo().expect(200, { version: 0 });

    const withoutLogo = (await getBranding().expect(200)).body as BrandingBody;
    expect(withoutLogo.version).toBe(0);
    expect(withoutLogo.logoUrl).toBeNull();
    expect(withoutLogo.faviconUrl).toBeNull();

    await getAsset('logo').expect(404).expect(({ body }) => {
      expect(body.error).toBe('ClinicAssetNotFoundError');
    });

    // Idempotent: no logo left to remove.
    await removeLogo().expect(200, { version: 0 });
  });

  it('rejects unsupported formats with 415 and unreadable images with 400', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>');

    const unsupported = await uploadLogo(svg, 'logo.svg').expect(415);
    expect(unsupported.body).toMatchObject({ error: 'UnsupportedImageFormatError' });

    const corrupted = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from('this is not really a png'),
    ]);

    const unreadable = await uploadLogo(corrupted).expect(400);
    expect(unreadable.body).toMatchObject({ error: 'InvalidImageError' });

    const missingFile = await request(app.getHttpServer())
      .post('/clinic/logo')
      .set('Authorization', authorization)
      .expect(400);

    expect(missingFile.body).toMatchObject({ error: 'InvalidImageError' });
  });

  it('rejects uploads over 5 MB with 413', async () => {
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1);

    await uploadLogo(oversized).expect(413);
  });

  it('protects the logo endpoints with settings:update (public reads stay open)', async () => {
    await request(app.getHttpServer()).post('/clinic/logo').expect(401);
    await request(app.getHttpServer()).delete('/clinic/logo').expect(401);
    await getBranding().expect(200);
    await getAsset('logo').expect(404); // public: not 401

    const reader = await createUserWithPermissions('reader@clinic.local', ['settings:read']);

    await uploadLogo(await pngOf(100, 100), 'logo.png', reader).expect(403);
    await removeLogo(reader).expect(403);

    const editor = await createUserWithPermissions('editor@clinic.local', [
      'settings:read',
      'settings:update',
    ]);

    await uploadLogo(await pngOf(100, 100), 'logo.png', editor).expect(201);
    await removeLogo(editor).expect(200, { version: 0 });
  });

  it('answers 404 for unknown variants and for a known variant with no logo', async () => {
    const unknown = await getAsset('banner').expect(404);
    expect(unknown.body).toMatchObject({ error: 'UnknownVariantError' });

    const missing = await getAsset('logo').expect(404);
    expect(missing.body).toMatchObject({ error: 'ClinicAssetNotFoundError' });
  });
});
