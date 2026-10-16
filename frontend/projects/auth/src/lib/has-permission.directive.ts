import {
  Directive,
  type EmbeddedViewRef,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
  input,
} from '@angular/core';
import { SessionStore } from './session-store';

function toKeys(value: string | readonly string[]): readonly string[] {
  return typeof value === 'string' ? [value] : value;
}

/**
 * Structural directive: renders its template only while the session holds the
 * required permission(s), and reacts live to role/permission changes.
 *
 * ```html
 * <button *hasPermission="'users:create'">…</button>
 * <a *hasPermission="['roles:read', 'settings:read']; mode: 'any'">…</a>
 * ```
 */
@Directive({ selector: '[hasPermission]' })
export class HasPermissionDirective {
  private readonly store = inject(SessionStore);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly template = inject(TemplateRef<unknown>);

  /** Key(s) required to render the element: a single string or an array. */
  readonly hasPermission = input.required<string | readonly string[]>();

  /** `all` (default) requires every key; `any` requires at least one. */
  readonly hasPermissionMode = input<'all' | 'any'>('all');

  private view: EmbeddedViewRef<unknown> | null = null;

  constructor() {
    effect(() => {
      const keys = toKeys(this.hasPermission());
      const allowed =
        this.hasPermissionMode() === 'any'
          ? this.store.hasAny(...keys)
          : this.store.hasAll(...keys);

      if (allowed && this.view === null) {
        this.view = this.viewContainer.createEmbeddedView(this.template);
      } else if (!allowed && this.view !== null) {
        this.view.destroy();
        this.view = null;
      }
    });
  }
}
