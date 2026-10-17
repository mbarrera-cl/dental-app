/**
 * Menu kinds stored by the navigation module. `item` points somewhere (route
 * key or external URL), `group` nests one level of children and `divider` is
 * a pure separator.
 */
export type MenuKind = 'item' | 'group' | 'divider';

/** One node of the menu tree as served by `/navigation` (children nested). */
export interface MenuItem {
  id: string;
  kind: MenuKind;
  /** Literal label; `null` falls back to the route registry's i18n label. */
  label: string | null;
  /** ID of the curated lucide catalog (e.g. `lucideUsers`). */
  icon: string | null;
  /** Registry key of the target route (`patients`, `settings.menu`, ...). */
  routeKey: string | null;
  /** External destination (https only), for items leaving the app. */
  externalUrl: string | null;
  parentId: string | null;
  position: number;
  /** Permission needed to see the entry; `null` = every authenticated user. */
  requiredPermission: string | null;
  enabled: boolean;
  children: MenuItem[];
}

export interface CreateMenuItemPayload {
  kind: MenuKind;
  label?: string | null;
  icon?: string | null;
  routeKey?: string | null;
  externalUrl?: string | null;
  parentId?: string | null;
  requiredPermission?: string | null;
  enabled?: boolean;
}

/** Partial update payload; `kind` and the parent are fixed after creation. */
export type UpdateMenuItemPayload = Omit<CreateMenuItemPayload, 'kind' | 'parentId'>;

/** One entry of a drag & drop batch (`PUT /navigation/order`). */
export interface MenuReorderEntry {
  id: string;
  parentId: string | null;
  position: number;
}
