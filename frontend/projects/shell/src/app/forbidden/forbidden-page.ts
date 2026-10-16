import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideShieldX } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@ui/button';

/** Landing page of `permissionGuard` when the session lacks the keys. */
@Component({
  selector: 'app-forbidden-page',
  imports: [RouterLink, NgIcon, TranslocoPipe, HlmButton],
  providers: [provideIcons({ lucideShieldX })],
  template: `
    <section class="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <span class="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-full">
        <ng-icon name="lucideShieldX" class="text-2xl" />
      </span>
      <h2 class="text-2xl font-semibold tracking-tight">{{ 'forbidden.title' | transloco }}</h2>
      <p class="text-muted-foreground text-sm">{{ 'forbidden.description' | transloco }}</p>
      <a hlmBtn routerLink="/">{{ 'forbidden.back' | transloco }}</a>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForbiddenPage {}
