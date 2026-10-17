import { dashboardCategory } from '../../../shared/security/permissions.js';
import { agendaPermissions } from '../../agenda/permissions.js';
import { apiKeysPermissions } from '../../apikeys/permissions.js';
import { caroIaPermissions } from '../../caro-ia/permissions.js';
import { patientsPermissions } from '../../patients/permissions.js';
import { quotesPermissions } from '../../quotes/permissions.js';
import { rolesPermissions } from '../../roles/permissions.js';
import { settingsPermissions } from '../../settings/permissions.js';
import { ucoPermissions } from '../../uco/permissions.js';
import { usersPermissions } from '../../users/permissions.js';
import { MenuItem, type MenuKind } from './menu-item.entity.js';

interface DefaultMenuEntry {
  readonly kind: MenuKind;
  readonly label?: string;
  readonly icon?: string;
  readonly routeKey?: string;
  readonly requiredPermission?: string;
  readonly children?: readonly DefaultMenuEntry[];
}

/**
 * Menu shipped on a fresh database (and restored by `POST /navigation/reset`):
 * a mirror of the application's real routes. Route items carry no literal
 * label — the frontend resolves their i18n label from the route registry, so
 * they stay translated; groups are plain data and can be renamed freely.
 */
export const DEFAULT_MENU: readonly DefaultMenuEntry[] = [
  {
    kind: 'item',
    icon: 'lucideStethoscope',
    routeKey: 'patients',
    requiredPermission: patientsPermissions.read,
  },
  {
    kind: 'item',
    icon: 'lucideLayoutDashboard',
    routeKey: 'dashboard',
    requiredPermission: dashboardCategory.keys.read,
  },
  {
    kind: 'item',
    icon: 'lucideCalendar',
    routeKey: 'agenda',
    requiredPermission: agendaPermissions.read,
  },
  {
    kind: 'item',
    icon: 'lucideUsers',
    routeKey: 'users',
    requiredPermission: usersPermissions.read,
  },
  {
    kind: 'item',
    icon: 'lucideFileText',
    routeKey: 'quotes',
    requiredPermission: quotesPermissions.read,
  },
  {
    kind: 'item',
    icon: 'lucideSparkles',
    routeKey: 'caroIa',
    requiredPermission: caroIaPermissions.use,
  },
  {
    kind: 'group',
    label: 'Administración',
    icon: 'lucideSettings',
    children: [
      {
        kind: 'item',
        icon: 'lucideShieldCheck',
        routeKey: 'admin.roles',
        requiredPermission: rolesPermissions.read,
      },
      {
        kind: 'item',
        icon: 'lucideSlidersHorizontal',
        routeKey: 'admin.settings',
        requiredPermission: settingsPermissions.read,
      },
      {
        kind: 'item',
        icon: 'lucideKeyRound',
        routeKey: 'admin.apiKeys',
        requiredPermission: apiKeysPermissions.read,
      },
      {
        kind: 'item',
        icon: 'lucidePanelLeft',
        routeKey: 'settings.menu',
        requiredPermission: settingsPermissions.read,
      },
      {
        kind: 'item',
        icon: 'lucideBuilding2',
        routeKey: 'settings.clinic',
        requiredPermission: settingsPermissions.read,
      },
      {
        kind: 'item',
        icon: 'lucideBadgeDollarSign',
        routeKey: 'admin.uco',
        requiredPermission: ucoPermissions.read,
      },
    ],
  },
  {
    kind: 'group',
    label: 'Mi cuenta',
    icon: 'lucideCircleUser',
    children: [
      {
        kind: 'item',
        icon: 'lucideKeyRound',
        routeKey: 'account.apiKeys',
        requiredPermission: apiKeysPermissions.self,
      },
    ],
  },
];

/**
 * Materializes the default menu as entities, parent-first (the order the
 * repository needs to satisfy the `parent_id` foreign key).
 */
export function buildDefaultMenuItems(): MenuItem[] {
  const items: MenuItem[] = [];

  DEFAULT_MENU.forEach((entry, position) => {
    collect(entry, null, position, items);
  });

  return items;
}

function collect(
  entry: DefaultMenuEntry,
  parentId: string | null,
  position: number,
  items: MenuItem[],
): void {
  const item = MenuItem.create({
    kind: entry.kind,
    label: entry.label ?? null,
    icon: entry.icon ?? null,
    routeKey: entry.routeKey ?? null,
    parentId,
    requiredPermission: entry.requiredPermission ?? null,
  });

  item.setPosition(position);
  items.push(item);

  entry.children?.forEach((child, index) => {
    collect(child, item.id, index, items);
  });
}
