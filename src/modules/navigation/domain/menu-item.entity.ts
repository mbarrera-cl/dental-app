import { Entity } from '../../../shared/domain/entity.js';
import { PermissionUnknownError } from '../../../shared/security/permission.errors.js';
import { isPermissionKey } from '../../../shared/security/permissions.js';
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

/** The three kinds of node a menu can hold. */
export const MENU_KINDS = ['item', 'group', 'divider'] as const;

export type MenuKind = (typeof MENU_KINDS)[number];

export const MENU_LABEL_MAX_LENGTH = 60;
export const MENU_ICON_MAX_LENGTH = 40;
export const MENU_ROUTE_KEY_MAX_LENGTH = 80;
export const MENU_EXTERNAL_URL_MAX_LENGTH = 300;

/** Route keys are dotted lowercase identifiers of the frontend registry. */
const ROUTE_KEY_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)*$/;

export interface MenuItemProps {
  /** Parent group id; only `item` and `divider` nodes may have one. */
  parentId: string | null;
  kind: MenuKind;
  /** Literal label; `null` means "use the route registry's i18n label". */
  label: string | null;
  icon: string | null;
  /** Registry key of the target route (never a free-form path). */
  routeKey: string | null;
  /** External destination, `https://` only. */
  externalUrl: string | null;
  position: number;
  /** Permission required to see the entry; `null` = any authenticated user. */
  requiredPermission: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface CreateMenuItemProps {
  kind: MenuKind;
  label?: string | null;
  icon?: string | null;
  routeKey?: string | null;
  externalUrl?: string | null;
  parentId?: string | null;
  requiredPermission?: string | null;
  enabled?: boolean;
  createdBy?: string | null;
}

/**
 * A configurable menu entry. The route it points to lives in code (the
 * frontend route registry): this entity only models presentation — that is
 * why a dangling route key is *not* a domain error here, it is a frontend
 * concern (unknown keys are hidden and flagged by the editor).
 */
export class MenuItem extends Entity<MenuItemProps> {
  private constructor(props: MenuItemProps, id?: string) {
    super(props, id);
  }

  static create(input: CreateMenuItemProps): MenuItem {
    const kind = MenuItem.normalizeKind(input.kind);
    const parentId = normalizeOptional(input.parentId);

    if (kind === 'group' && parentId !== null) {
      throw new NestedMenuGroupError();
    }

    const destination = MenuItem.normalizeDestination(kind, input.routeKey, input.externalUrl);
    const now = new Date();
    const actorId = normalizeOptional(input.createdBy);

    return new MenuItem({
      parentId,
      kind,
      label: MenuItem.normalizeLabel(kind, input.label),
      icon: MenuItem.normalizeIcon(input.icon),
      routeKey: destination.routeKey,
      externalUrl: destination.externalUrl,
      position: 0,
      requiredPermission: MenuItem.normalizePermission(input.requiredPermission),
      enabled: input.enabled ?? true,
      createdAt: now,
      updatedAt: now,
      createdBy: actorId,
      updatedBy: actorId,
    });
  }

  static reconstitute(props: MenuItemProps, id: string): MenuItem {
    return new MenuItem(props, id);
  }

  get parentId(): string | null {
    return this.props.parentId;
  }

  get kind(): MenuKind {
    return this.props.kind;
  }

  get label(): string | null {
    return this.props.label;
  }

  get icon(): string | null {
    return this.props.icon;
  }

  get routeKey(): string | null {
    return this.props.routeKey;
  }

  get externalUrl(): string | null {
    return this.props.externalUrl;
  }

  get position(): number {
    return this.props.position;
  }

  get requiredPermission(): string | null {
    return this.props.requiredPermission;
  }

  get enabled(): boolean {
    return this.props.enabled;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get createdBy(): string | null {
    return this.props.createdBy;
  }

  get updatedBy(): string | null {
    return this.props.updatedBy;
  }

  /** `null` (or a blank string) falls back to the registry's i18n label. */
  rename(label: string | null, actorId: string | null = null): void {
    if (this.props.kind === 'divider') {
      throw new InvalidMenuLabelError('dividers cannot have a label');
    }

    this.props.label = MenuItem.normalizeLabel(this.props.kind, label);
    this.touch(actorId);
  }

  changeIcon(icon: string | null, actorId: string | null = null): void {
    this.props.icon = MenuItem.normalizeIcon(icon);
    this.touch(actorId);
  }

  /**
   * Replaces the whole destination: pass the route key and/or the external
   * URL exactly as they should remain (missing values become `null`).
   */
  changeDestination(
    routeKey: string | null,
    externalUrl: string | null,
    actorId: string | null = null,
  ): void {
    const destination = MenuItem.normalizeDestination(this.props.kind, routeKey, externalUrl);
    this.props.routeKey = destination.routeKey;
    this.props.externalUrl = destination.externalUrl;
    this.touch(actorId);
  }

  requirePermission(permission: string | null, actorId: string | null = null): void {
    this.props.requiredPermission = MenuItem.normalizePermission(permission);
    this.touch(actorId);
  }

  setEnabled(enabled: boolean, actorId: string | null = null): void {
    this.props.enabled = enabled;
    this.touch(actorId);
  }

  /** Placement metadata; does not count as a user-visible edit. */
  setPosition(position: number): void {
    if (!Number.isInteger(position) || position < 0) {
      throw new InvalidMenuPositionError(position);
    }

    this.props.position = position;
  }

  moveTo(parentId: string | null, position: number, actorId: string | null = null): void {
    if (this.props.kind === 'group' && parentId !== null) {
      throw new NestedMenuGroupError();
    }

    this.props.parentId = parentId;
    this.setPosition(position);
    this.touch(actorId);
  }

  private touch(actorId: string | null): void {
    this.props.updatedAt = new Date();
    this.props.updatedBy = actorId;
  }

  private static normalizeKind(kind: string): MenuKind {
    if (!(MENU_KINDS as readonly string[]).includes(kind)) {
      throw new InvalidMenuItemKindError(kind);
    }

    return kind as MenuKind;
  }

  private static normalizeLabel(kind: MenuKind, label?: string | null): string | null {
    const normalized = normalizeOptional(label);

    if (normalized === null) {
      return null;
    }

    if (kind === 'divider') {
      throw new InvalidMenuLabelError('dividers cannot have a label');
    }

    if (normalized.length > MENU_LABEL_MAX_LENGTH) {
      throw new InvalidMenuLabelError(`at most ${MENU_LABEL_MAX_LENGTH} characters long`);
    }

    return normalized;
  }

  private static normalizeIcon(icon?: string | null): string | null {
    const normalized = normalizeOptional(icon);

    if (normalized !== null && normalized.length > MENU_ICON_MAX_LENGTH) {
      throw new InvalidMenuIconError(normalized);
    }

    return normalized;
  }

  private static normalizeDestination(
    kind: MenuKind,
    routeKey?: string | null,
    externalUrl?: string | null,
  ): { routeKey: string | null; externalUrl: string | null } {
    const route = normalizeOptional(routeKey);
    const external = normalizeOptional(externalUrl);

    if (kind !== 'item') {
      if (route !== null || external !== null) {
        throw new InvalidMenuDestinationError(kind);
      }

      return { routeKey: null, externalUrl: null };
    }

    if ((route === null) === (external === null)) {
      throw new InvalidMenuDestinationError(kind);
    }

    if (route !== null) {
      if (route.length > MENU_ROUTE_KEY_MAX_LENGTH || !ROUTE_KEY_PATTERN.test(route)) {
        throw new InvalidMenuRouteKeyError(route);
      }

      return { routeKey: route, externalUrl: null };
    }

    return { routeKey: null, externalUrl: MenuItem.normalizeExternalUrl(external as string) };
  }

  private static normalizeExternalUrl(value: string): string {
    if (value.length > MENU_EXTERNAL_URL_MAX_LENGTH) {
      throw new InvalidMenuExternalUrlError(value);
    }

    let url: URL;

    try {
      url = new URL(value);
    } catch {
      throw new InvalidMenuExternalUrlError(value);
    }

    // Only clean https destinations: no javascript:/data:/http:, no
    // credentials embedded in the URL.
    if (url.protocol !== 'https:' || url.hostname.length === 0 || url.username !== '' || url.password !== '') {
      throw new InvalidMenuExternalUrlError(value);
    }

    return url.toString();
  }

  private static normalizePermission(permission?: string | null): string | null {
    const key = normalizeOptional(permission);

    if (key === null) {
      return null;
    }

    if (!isPermissionKey(key)) {
      throw new PermissionUnknownError([key]);
    }

    return key;
  }
}

function normalizeOptional(value?: string | null): string | null {
  const trimmed = value?.trim() ?? '';

  return trimmed === '' ? null : trimmed;
}
