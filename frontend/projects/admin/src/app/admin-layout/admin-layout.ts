import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideKeyRound, lucideSettings, lucideShieldCheck } from '@ng-icons/lucide';
import { HasPermissionDirective, PERMISSION_KEYS } from 'auth';

/**
 * Chrome of the admin panel: title plus one tab per section. Tabs are hidden
 * without the matching permission (the server enforces them anyway) and the
 * section pages render into the nested outlet.
 */
@Component({
  selector: 'app-admin-layout',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TranslocoPipe,
    NgIcon,
    HasPermissionDirective,
  ],
  providers: [provideIcons({ lucideShieldCheck, lucideSettings, lucideKeyRound })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col gap-6">
      <header class="grid gap-1">
        <h2 class="text-2xl font-semibold tracking-tight">{{ 'admin.title' | transloco }}</h2>
        <p class="text-muted-foreground text-sm">{{ 'admin.subtitle' | transloco }}</p>
      </header>

      <nav class="flex flex-wrap gap-1 border-b" [attr.aria-label]="'admin.title' | transloco">
        <a
          *hasPermission="permissionKeys.roles.read"
          routerLink="roles"
          routerLinkActive="border-primary text-foreground"
          class="text-muted-foreground hover:text-foreground -mb-px flex items-center gap-2 border-b-2 border-transparent px-3 py-2 text-sm font-medium"
          data-testid="admin-tab-roles"
        >
          <ng-icon name="lucideShieldCheck" />
          {{ 'admin.tabs.roles' | transloco }}
        </a>
        <a
          *hasPermission="permissionKeys.settings.read"
          routerLink="settings"
          routerLinkActive="border-primary text-foreground"
          class="text-muted-foreground hover:text-foreground -mb-px flex items-center gap-2 border-b-2 border-transparent px-3 py-2 text-sm font-medium"
          data-testid="admin-tab-settings"
        >
          <ng-icon name="lucideSettings" />
          {{ 'admin.tabs.settings' | transloco }}
        </a>
        <a
          *hasPermission="permissionKeys.apiKeys.read"
          routerLink="api-keys"
          routerLinkActive="border-primary text-foreground"
          class="text-muted-foreground hover:text-foreground -mb-px flex items-center gap-2 border-b-2 border-transparent px-3 py-2 text-sm font-medium"
          data-testid="admin-tab-api-keys"
        >
          <ng-icon name="lucideKeyRound" />
          {{ 'admin.tabs.apiKeys' | transloco }}
        </a>
      </nav>

      <router-outlet />
    </section>
  `,
})
export class AdminLayout {
  /** Typed permission keys, so the template never hard-codes strings. */
  protected readonly permissionKeys = PERMISSION_KEYS;
}
