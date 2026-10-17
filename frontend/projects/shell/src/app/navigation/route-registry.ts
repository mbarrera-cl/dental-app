/**
 * Code-side route registry: the *routes* of the application. The database
 * menu references them by key; keys missing here never render (and the editor
 * flags them), so route refactors are self-healing: a renamed path only
 * touches this file.
 *
 * `label` is the Transloco key of the default label shown when the database
 * entry carries no literal label — that keeps registry items translated.
 */
export interface NavigationRoute {
  /** `route_key` stored in the database. */
  readonly key: string;
  /** Absolute path of the router route. */
  readonly path: string;
  /** Transloco key of the default label. */
  readonly label: string;
  /** Default icon ID from the curated catalog (see `icon-catalog`). */
  readonly icon: string;
}

export const NAVIGATION_ROUTES: readonly NavigationRoute[] = [
  {
    key: 'patients',
    path: '/patients',
    label: 'shell.navPatients',
    icon: 'lucideStethoscope',
  },
  {
    key: 'dashboard',
    path: '/dashboard',
    label: 'shell.navDashboard',
    icon: 'lucideLayoutDashboard',
  },
  {
    key: 'agenda',
    path: '/agenda',
    label: 'shell.navAgenda',
    icon: 'lucideCalendar',
  },
  {
    key: 'users',
    path: '/users',
    label: 'shell.navUsers',
    icon: 'lucideUsers',
  },
  {
    key: 'admin.roles',
    path: '/admin/roles',
    label: 'shell.navAdminRoles',
    icon: 'lucideShieldCheck',
  },
  {
    key: 'admin.settings',
    path: '/admin/settings',
    label: 'shell.navAdminSettings',
    icon: 'lucideSlidersHorizontal',
  },
  {
    key: 'admin.apiKeys',
    path: '/admin/api-keys',
    label: 'shell.navAdminApiKeys',
    icon: 'lucideKeyRound',
  },
  {
    key: 'account.apiKeys',
    path: '/account/api-keys',
    label: 'shell.navApiKeys',
    icon: 'lucideKeyRound',
  },
  {
    key: 'settings.menu',
    path: '/settings/menu',
    label: 'shell.navMenu',
    icon: 'lucidePanelLeft',
  },
  {
    key: 'settings.clinic',
    path: '/settings/clinic',
    label: 'shell.navClinic',
    icon: 'lucideBuilding2',
  },
  {
    key: 'quotes',
    path: '/quotes',
    label: 'shell.navQuotes',
    icon: 'lucideFileText',
  },
  {
    key: 'caroIa',
    path: '/caro-ia',
    label: 'shell.navCaroIa',
    icon: 'lucideSparkles',
  },
  {
    key: 'admin.uco',
    path: '/admin/uco',
    label: 'shell.navAdminUco',
    icon: 'lucideBadgeDollarSign',
  },
];

const ROUTES_BY_KEY = new Map(NAVIGATION_ROUTES.map((route) => [route.key, route]));

/** Resolves a database `route_key`; `undefined` when it left the registry. */
export function resolveRoute(routeKey: string): NavigationRoute | undefined {
  return ROUTES_BY_KEY.get(routeKey);
}

/** The default icon of a registry entry (fallback when the entry has none). */
export function defaultIcon(routeKey: string | null): string | undefined {
  return routeKey === null ? undefined : ROUTES_BY_KEY.get(routeKey)?.icon;
}
