import { MenuItem, type MenuKind } from './menu-item.entity.js';
import {
  InvalidMenuDestinationError,
  InvalidMenuExternalUrlError,
  InvalidMenuIconError,
  InvalidMenuItemKindError,
  InvalidMenuLabelError,
  InvalidMenuPositionError,
  InvalidMenuRouteKeyError,
  NestedMenuGroupError,
} from './menu-item.errors.js';

describe('MenuItem', () => {
  it('creates a route item with its defaults', () => {
    const item = MenuItem.create({ kind: 'item', routeKey: 'patients' });

    expect(item.kind).toBe('item');
    expect(item.routeKey).toBe('patients');
    expect(item.externalUrl).toBeNull();
    expect(item.parentId).toBeNull();
    expect(item.position).toBe(0);
    expect(item.label).toBeNull();
    expect(item.requiredPermission).toBeNull();
    expect(item.enabled).toBe(true);
    expect(item.createdAt).toEqual(item.updatedAt);
  });

  it('trims optional fields and normalizes blanks to null', () => {
    const item = MenuItem.create({
      kind: 'item',
      routeKey: '  patients  ',
      label: '  Pacientes  ',
      icon: '  lucideUsers  ',
    });

    expect(item.routeKey).toBe('patients');
    expect(item.label).toBe('Pacientes');
    expect(item.icon).toBe('lucideUsers');

    const blank = MenuItem.create({ kind: 'item', routeKey: 'patients', label: '   ', icon: '' });

    expect(blank.label).toBeNull();
    expect(blank.icon).toBeNull();
  });

  it('normalizes clean https external URLs', () => {
    const item = MenuItem.create({
      kind: 'item',
      externalUrl: 'https://intranet.example.com/agenda',
    });

    expect(item.externalUrl).toBe('https://intranet.example.com/agenda');
    expect(item.routeKey).toBeNull();
  });

  it('rejects unknown kinds', () => {
    expect(() =>
      MenuItem.create({ kind: 'banner' as unknown as MenuKind, routeKey: 'patients' }),
    ).toThrow(InvalidMenuItemKindError);
  });

  it('requires exactly one destination for items', () => {
    expect(() => MenuItem.create({ kind: 'item' })).toThrow(InvalidMenuDestinationError);
    expect(() =>
      MenuItem.create({ kind: 'item', routeKey: 'patients', externalUrl: 'https://example.com' }),
    ).toThrow(InvalidMenuDestinationError);
  });

  it('rejects destinations on groups and dividers', () => {
    expect(() => MenuItem.create({ kind: 'group', routeKey: 'patients' })).toThrow(
      InvalidMenuDestinationError,
    );
    expect(() => MenuItem.create({ kind: 'divider', externalUrl: 'https://example.com' })).toThrow(
      InvalidMenuDestinationError,
    );
  });

  it('rejects nested groups', () => {
    expect(() => MenuItem.create({ kind: 'group', label: 'Admin', parentId: 'group-id' })).toThrow(
      NestedMenuGroupError,
    );
  });

  it('accepts only clean https external URLs', () => {
    const rejected = [
      'http://insecure.example.com',
      'javascript:alert(1)',
      'data:text/html;base64,PGI+',
      'https://user:pass@example.com',
      'ftp://example.com',
      'not a url',
      `https://example.com/${'x'.repeat(300)}`,
    ];

    for (const url of rejected) {
      expect(() => MenuItem.create({ kind: 'item', externalUrl: url })).toThrow(
        InvalidMenuExternalUrlError,
      );
    }
  });

  it('validates route keys', () => {
    const rejected = ['Patients', 'settings.', '.settings', 'settings..menu', '1patients', 'settings menu'];

    for (const routeKey of rejected) {
      expect(() => MenuItem.create({ kind: 'item', routeKey })).toThrow(InvalidMenuRouteKeyError);
    }

    expect(() => MenuItem.create({ kind: 'item', routeKey: 'x'.repeat(81) })).toThrow(
      InvalidMenuRouteKeyError,
    );
    expect(MenuItem.create({ kind: 'item', routeKey: 'settings.clinic' }).routeKey).toBe(
      'settings.clinic',
    );
  });

  it('rejects labels on dividers and overlong labels or icons', () => {
    expect(() => MenuItem.create({ kind: 'divider', label: 'Sección' })).toThrow(
      InvalidMenuLabelError,
    );
    expect(() =>
      MenuItem.create({ kind: 'item', routeKey: 'patients', label: 'x'.repeat(61) }),
    ).toThrow(InvalidMenuLabelError);
    expect(() =>
      MenuItem.create({ kind: 'item', routeKey: 'patients', icon: 'x'.repeat(41) }),
    ).toThrow(InvalidMenuIconError);
  });

  it('validates required permissions against the catalog', () => {
    const item = MenuItem.create({
      kind: 'item',
      routeKey: 'patients',
      requiredPermission: 'patients:read',
    });

    expect(item.requiredPermission).toBe('patients:read');
    expect(() =>
      MenuItem.create({ kind: 'item', routeKey: 'patients', requiredPermission: 'ghost:read' }),
    ).toThrow('Unknown permission(s): ghost:read');
  });

  it('validates positions', () => {
    const item = MenuItem.create({ kind: 'item', routeKey: 'patients' });

    expect(() => item.setPosition(-1)).toThrow(InvalidMenuPositionError);
    expect(() => item.setPosition(1.5)).toThrow(InvalidMenuPositionError);
  });

  it('moves items between parents but never groups', () => {
    const item = MenuItem.create({ kind: 'item', routeKey: 'patients' });
    const group = MenuItem.create({ kind: 'group', label: 'Admin' });

    item.moveTo(group.id, 2);
    expect(item.parentId).toBe(group.id);
    expect(item.position).toBe(2);

    expect(() => group.moveTo('other-group', 0)).toThrow(NestedMenuGroupError);
  });

  it('touches updatedAt (and the actor) through mutators', () => {
    vi.useFakeTimers();

    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
      const item = MenuItem.create({ kind: 'item', routeKey: 'patients', createdBy: 'admin-id' });

      expect(item.createdBy).toBe('admin-id');
      expect(item.updatedBy).toBe('admin-id');

      vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'));
      item.setEnabled(false, 'editor-id');

      expect(item.enabled).toBe(false);
      expect(item.updatedAt.toISOString()).toBe('2026-01-02T00:00:00.000Z');
      expect(item.updatedBy).toBe('editor-id');
    } finally {
      vi.useRealTimers();
    }
  });

  it('replaces the destination pair and can clear the permission', () => {
    const item = MenuItem.create({
      kind: 'item',
      routeKey: 'patients',
      requiredPermission: 'patients:read',
    });

    item.changeDestination(null, 'https://intranet.example.com', null);
    expect(item.routeKey).toBeNull();
    expect(item.externalUrl).toBe('https://intranet.example.com/');

    expect(() => item.changeDestination(null, null, null)).toThrow(InvalidMenuDestinationError);

    item.requirePermission(null, null);
    expect(item.requiredPermission).toBeNull();
  });
});
