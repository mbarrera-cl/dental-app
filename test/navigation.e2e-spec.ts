import { Test, TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/shared/infrastructure/app-setup.js';
import { SqliteDatabase } from './../src/shared/infrastructure/database/sqlite-database.js';
import { clearE2eAdminCredentials, loginAsAdmin, useE2eAdminCredentials } from './helpers/auth.js';

interface MenuNode {
  id: string;
  kind: 'item' | 'group' | 'divider';
  label: string | null;
  icon: string | null;
  routeKey: string | null;
  externalUrl: string | null;
  parentId: string | null;
  position: number;
  requiredPermission: string | null;
  enabled: boolean;
  children: MenuNode[];
}

/**
 * Configurable side menu end to end: the seed, per-principal filtering, the
 * CRUD (with validation), drag & drop reordering/normalization, hiding and
 * the anti-lockout reset.
 */
describe('Navigation (e2e)', () => {
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

  const getMine = (token: string = authorization) =>
    request(app.getHttpServer()).get('/navigation').set('Authorization', token);

  const getItems = (token: string = authorization) =>
    request(app.getHttpServer()).get('/navigation/items').set('Authorization', token);

  const createItem = (payload: object, token: string = authorization) =>
    request(app.getHttpServer())
      .post('/navigation/items')
      .set('Authorization', token)
      .send(payload);

  const patchItem = (id: string, payload: object, token: string = authorization) =>
    request(app.getHttpServer())
      .patch(`/navigation/items/${id}`)
      .set('Authorization', token)
      .send(payload);

  const deleteItem = (id: string, token: string = authorization) =>
    request(app.getHttpServer()).delete(`/navigation/items/${id}`).set('Authorization', token);

  const reorder = (items: object[], token: string = authorization) =>
    request(app.getHttpServer()).put('/navigation/order').set('Authorization', token).send({ items });

  const resetMenu = (token: string = authorization) =>
    request(app.getHttpServer()).post('/navigation/reset').set('Authorization', token);

  /** Creates a user with `permissions` as direct grants; returns its bearer token. */
  const createUserWithPermissions = async (
    email: string,
    permissions: string[],
  ): Promise<{ id: string; token: string }> => {
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

    return { id, token: `Bearer ${(login.body as { accessToken: string }).accessToken}` };
  };

  const outline = (nodes: MenuNode[]): unknown[] =>
    nodes.map(({ routeKey, label, kind, children }) => ({
      key: routeKey ?? label ?? kind,
      children: outline(children),
    }));

  const keys = (nodes: MenuNode[]): string[] =>
    nodes.map((node) => node.routeKey ?? node.label ?? node.kind);

  const flatten = (nodes: MenuNode[]): MenuNode[] =>
    nodes.flatMap((node) => [node, ...flatten(node.children)]);

  const findById = (nodes: MenuNode[], id: string): MenuNode | undefined =>
    flatten(nodes).find((node) => node.id === id);

  it('requires authentication', async () => {
    await request(app.getHttpServer()).get('/navigation').expect(401);
    await request(app.getHttpServer()).get('/navigation/items').expect(401);
    await request(app.getHttpServer()).post('/navigation/items').send({ kind: 'divider' }).expect(401);
  });

  it('serves the seeded menu to the administrator', async () => {
    const tree = (await getMine().expect(200)).body as MenuNode[];

    expect(keys(tree)).toEqual(['patients', 'dashboard', 'users', 'Administración', 'Mi cuenta']);

    const patients = tree[0]!;
    expect(patients).toMatchObject({
      kind: 'item',
      icon: 'lucideStethoscope',
      requiredPermission: 'patients:read',
      enabled: true,
      label: null,
    });

    const adminGroup = tree[3]!;
    expect(adminGroup.kind).toBe('group');
    expect(adminGroup.children.map((child) => child.routeKey)).toEqual([
      'admin.roles',
      'admin.settings',
      'admin.apiKeys',
    ]);
    expect(adminGroup.children.map((child) => child.position)).toEqual([0, 1, 2]);

    // Editors see exactly the same tree the sidebar would render.
    const full = (await getItems().expect(200)).body as MenuNode[];
    expect(outline(full)).toEqual(outline(tree));
  });

  it('filters by effective permissions and prunes empty groups', async () => {
    const { token } = await createUserWithPermissions('menu-user@e2e.local', ['patients:read']);

    const tree = (await getMine(token).expect(200)).body as MenuNode[];

    expect(tree).toHaveLength(1);
    expect(tree[0]!.routeKey).toBe('patients');

    const viewerOnly = await createUserWithPermissions('menu-dashboard@e2e.local', ['dashboard:read']);
    const dashboardTree = (await getMine(viewerOnly.token).expect(200)).body as MenuNode[];

    expect(keys(dashboardTree)).toEqual(['dashboard']);
  });

  it('reserves the editor endpoints for settings permissions', async () => {
    const { token } = await createUserWithPermissions('menu-limited@e2e.local', ['patients:read']);

    await getItems(token).expect(403);
    await createItem({ kind: 'divider' }, token).expect(403);
    await reorder([{ id: 'whatever', parentId: null, position: 0 }], token).expect(403);
    await resetMenu(token).expect(403);
  });

  it('creates, updates, hides and deletes entries', async () => {
    const created = await createItem({
      kind: 'item',
      label: 'Intranet',
      icon: 'lucideGlobe',
      externalUrl: 'https://intranet.example.com',
    }).expect(201);

    const intranet = created.body as MenuNode;
    expect(intranet.position).toBe(5); // after the five seeded roots
    expect(intranet.externalUrl).toBe('https://intranet.example.com/');
    expect(intranet.label).toBe('Intranet');

    // A route item appended to the end of a group.
    const full = (await getItems().expect(200)).body as MenuNode[];
    const adminGroup = full.find((node) => node.label === 'Administración')!;

    const menuChild = await createItem({
      kind: 'item',
      routeKey: 'settings.menu',
      parentId: adminGroup.id,
      requiredPermission: 'settings:read',
    }).expect(201);

    expect((menuChild.body as MenuNode).position).toBe(3);

    // Dividers are plain separators.
    const divider = await createItem({ kind: 'divider' }).expect(201);
    expect((divider.body as MenuNode).kind).toBe('divider');

    // Validation: destinations, kinds, permissions and parents.
    await createItem({ kind: 'item' }).expect(400);
    await createItem({ kind: 'item', routeKey: 'patients', externalUrl: 'https://x.example.com' }).expect(400);
    await createItem({ kind: 'item', externalUrl: 'http://insecure.example.com' }).expect(400);
    await createItem({ kind: 'item', externalUrl: 'javascript:alert(1)' }).expect(400);
    await createItem({ kind: 'group', parentId: adminGroup.id }).expect(400);
    await createItem({ kind: 'divider', label: 'Nope' }).expect(400);
    await createItem({ kind: 'item', routeKey: 'patients', requiredPermission: 'ghost:read' }).expect(400);
    await createItem({ kind: 'item', routeKey: 'patients', parentId: 123 }).expect(400);
    await createItem({ kind: 'item', routeKey: 'patients', parentId: 'missing-group' }).expect(400);
    await createItem({ kind: 'item', routeKey: 'Patients' }).expect(400);

    // Update: rename and hide; the sidebar stops showing it, the editor keeps it.
    await patchItem(intranet.id, { label: 'Portal interno', enabled: false }).expect(200);

    const mineAfterHide = (await getMine().expect(200)).body as MenuNode[];
    expect(flatten(mineAfterHide).some((node) => node.label === 'Portal interno')).toBe(false);

    const editorAfterHide = (await getItems().expect(200)).body as MenuNode[];
    const hidden = findById(editorAfterHide, intranet.id)!;
    expect(hidden).toMatchObject({ label: 'Portal interno', enabled: false });

    // Clearing the label falls back to the registry i18n label (null).
    await patchItem(intranet.id, { enabled: true, label: null }).expect(200);
    const shown = findById((await getMine().expect(200)).body as MenuNode[], intranet.id)!;
    expect(shown.label).toBeNull();

    // Empty updates, unknown permissions and unknown ids.
    await patchItem(intranet.id, {}).expect(400);
    await patchItem(intranet.id, { requiredPermission: 'ghost:read' }).expect(400);
    await patchItem('missing-id', { label: 'x' }).expect(404);

    // Delete is final.
    await deleteItem(intranet.id).expect(204);
    await deleteItem(intranet.id).expect(404);
  });

  it('reorders, re-parents and validates the drag & drop payload', async () => {
    const divider = (await createItem({ kind: 'divider' }).expect(201)).body as MenuNode;
    const full = (await getItems().expect(200)).body as MenuNode[];
    const patients = flatten(full).find((node) => node.routeKey === 'patients')!;
    const dashboard = flatten(full).find((node) => node.routeKey === 'dashboard')!;
    const users = flatten(full).find((node) => node.routeKey === 'users')!;
    const adminGroup = full.find((node) => node.label === 'Administración')!;
    const accountGroup = full.find((node) => node.label === 'Mi cuenta')!;

    // Full batch: place the divider between two visible entries.
    await reorder([
      { id: patients.id, parentId: null, position: 0 },
      { id: divider.id, parentId: null, position: 1 },
      { id: dashboard.id, parentId: null, position: 2 },
      { id: users.id, parentId: null, position: 3 },
      { id: adminGroup.id, parentId: null, position: 4 },
      { id: accountGroup.id, parentId: null, position: 5 },
    ]).expect(200);

    const mine = (await getMine().expect(200)).body as MenuNode[];
    expect(keys(mine)).toEqual(['patients', 'divider', 'dashboard', 'users', 'Administración', 'Mi cuenta']);

    // Move one entry into a group: positions are re-numbered 0..n.
    const afterMove = (await reorder([{ id: users.id, parentId: adminGroup.id, position: 10 }]).expect(200))
      .body as MenuNode[];

    const admins = afterMove.find((node) => node.label === 'Administración')!;
    expect(admins.children.map((child) => child.routeKey)).toEqual([
      'admin.roles',
      'admin.settings',
      'admin.apiKeys',
      'users',
    ]);
    expect(admins.children.map((child) => child.position)).toEqual([0, 1, 2, 3]);
    expect(flatten(afterMove).some((node) => node.routeKey === 'users' && node.parentId === null)).toBe(false);

    // Invalid payloads.
    await reorder([{ id: patients.id, parentId: dashboard.id, position: 0 }]).expect(400); // parent is not a group
    await reorder([{ id: patients.id, parentId: patients.id, position: 0 }]).expect(400); // self-parent
    await reorder([{ id: adminGroup.id, parentId: accountGroup.id, position: 0 }]).expect(400); // nested group
    await reorder([
      { id: patients.id, parentId: null, position: 0 },
      { id: patients.id, parentId: null, position: 1 },
    ]).expect(400); // duplicated id
    await reorder([{ id: 'missing-id', parentId: null, position: 0 }]).expect(404);
  });

  it('resets the menu to the default seed', async () => {
    const full = (await getItems().expect(200)).body as MenuNode[];
    const patients = flatten(full).find((node) => node.routeKey === 'patients')!;

    await deleteItem(patients.id).expect(204);
    expect(
      flatten((await getItems().expect(200)).body as MenuNode[]).some(
        (node) => node.routeKey === 'patients',
      ),
    ).toBe(false);

    const restored = (await resetMenu().expect(200)).body as MenuNode[];

    expect(keys(restored)).toEqual(['patients', 'dashboard', 'users', 'Administración', 'Mi cuenta']);
    expect(flatten(restored).filter((node) => node.kind === 'divider')).toHaveLength(0);
  });
});
