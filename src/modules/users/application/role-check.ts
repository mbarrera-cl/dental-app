import { RoleRepositoryPort } from '../../roles/application/ports/role-repository.port.js';
import { UnknownRoleError } from '../domain/user.errors.js';

/**
 * Validates that every requested role id exists in the roles catalog and
 * returns the de-duplicated list, so use cases never persist dangling
 * assignments. Shared by create and update so both fail identically.
 */
export async function assertKnownRoles(
  roles: RoleRepositoryPort,
  roleIds: readonly string[],
): Promise<string[]> {
  const unique = [...new Set(roleIds)];

  if (unique.length === 0) {
    return unique;
  }

  const known = new Set((await roles.findAll()).map(({ role }) => role.id));
  const unknown = unique.filter((id) => !known.has(id));

  if (unknown.length > 0) {
    throw new UnknownRoleError(unknown);
  }

  return unique;
}
