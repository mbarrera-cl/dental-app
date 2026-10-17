import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideHexagon, lucideMenu } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@ui/button';
import { HlmToaster } from '@ui/sonner';
import { SessionStore } from 'auth';
import { LanguageSwitcher } from './language-switcher';
import { NavigationStore } from './navigation/navigation-store';
import { Sidebar } from './navigation/sidebar';
import { UserMenu } from './user-menu';

/**
 * Shell chrome: brand header (language + user menu) around the configurable
 * sidebar and the routed remote. The navigation links live in the database —
 * see `Sidebar` — so this component only toggles the mobile drawer.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TranslocoPipe, NgIcon, HlmButton, HlmToaster, LanguageSwitcher, UserMenu, Sidebar],
  providers: [provideIcons({ lucideHexagon, lucideMenu })],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly store = inject(SessionStore);
  protected readonly navigation = inject(NavigationStore);
}
