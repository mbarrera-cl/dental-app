import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideHexagon,
  lucideLayoutDashboard,
  lucideSettings,
  lucideStethoscope,
  lucideUsers,
} from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@ui/button';
import { HlmToaster } from '@ui/sonner';
import { HasPermissionDirective, PERMISSION_KEYS, SessionStore } from 'auth';
import { LanguageSwitcher } from './language-switcher';
import { UserMenu } from './user-menu';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TranslocoPipe,
    NgIcon,
    HlmButton,
    HlmToaster,
    HasPermissionDirective,
    LanguageSwitcher,
    UserMenu,
  ],
  providers: [
    provideIcons({
      lucideHexagon,
      lucideUsers,
      lucideLayoutDashboard,
      lucideStethoscope,
      lucideSettings,
    }),
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly store = inject(SessionStore);

  /** Permission keys used by the navigation; a typo can only hide UI. */
  protected readonly keys = PERMISSION_KEYS;
}
