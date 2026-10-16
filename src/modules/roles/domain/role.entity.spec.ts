import { Role } from './role.entity.js';
import { InvalidRoleDescriptionError, InvalidRoleNameError } from './role.errors.js';

describe('Role', () => {
  const validProps = { name: 'Support team', permissions: ['users:read'] };

  it('normalizes name and description and defaults to a regular role', () => {
    const role = Role.create({ name: '  Support team  ', description: '  Desks  ', permissions: ['users:read'] });

    expect(role.name).toBe('Support team');
    expect(role.description).toBe('Desks');
    expect(role.builtIn).toBe(false);
    expect(role.isProtected).toBe(false);
    expect(role.createdAt).toEqual(role.updatedAt);
  });

  it('rejects invalid names', () => {
    expect(() => Role.create({ ...validProps, name: 'a' })).toThrow(InvalidRoleNameError);
    expect(() => Role.create({ ...validProps, name: '!nope' })).toThrow(InvalidRoleNameError);
    expect(() => Role.create({ ...validProps, name: 'x'.repeat(41) })).toThrow(InvalidRoleNameError);
  });

  it('accepts accented and spaced names', () => {
    expect(Role.create({ ...validProps, name: 'Soporte técnico N2' }).name).toBe('Soporte técnico N2');
  });

  it('rejects overlong descriptions', () => {
    expect(() =>
      Role.create({ ...validProps, description: 'x'.repeat(201) }),
    ).toThrow(InvalidRoleDescriptionError);
  });

  it('deduplicates permissions and keeps them in catalog order', () => {
    const role = Role.create({
      ...validProps,
      permissions: ['users:update', 'users:read', 'settings:read', 'users:update'],
    });

    expect(role.permissions).toEqual(['users:read', 'users:update', 'settings:read']);
  });

  it('rejects permissions outside the catalog', () => {
    expect(() => Role.create({ ...validProps, permissions: ['users:read', 'nope:do'] })).toThrow(
      'Unknown permission(s): nope:do',
    );
  });

  it('reports whether it grants a permission', () => {
    const role = Role.create(validProps);

    expect(role.hasPermission('users:read')).toBe(true);
    expect(role.hasPermission('users:delete')).toBe(false);
  });

  it('re-validates invariants through mutators and touches updatedAt', () => {
    vi.useFakeTimers();

    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
      const role = Role.create(validProps);

      vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'));
      role.rename('Support L2');
      role.changeDescription('Second level');
      role.changePermissions(['settings:update']);

      expect(role.name).toBe('Support L2');
      expect(role.description).toBe('Second level');
      expect(role.permissions).toEqual(['settings:update']);
      expect(role.updatedAt).toEqual(new Date('2026-01-02T00:00:00.000Z'));
      expect(() => role.changePermissions(['nope:do'])).toThrow('Unknown permission(s): nope:do');
      expect(role.permissions).toEqual(['settings:update']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reconstitutes built-in roles as protected', () => {
    const role = Role.reconstitute(
      {
        name: 'admin',
        description: 'Built-in',
        permissions: ['users:read'],
        builtIn: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      'role-admin',
    );

    expect(role.builtIn).toBe(true);
    expect(role.isProtected).toBe(true);
  });
});
