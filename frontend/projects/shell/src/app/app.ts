import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideHexagon, lucideLayoutDashboard, lucideUsers } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmToaster } from '@ui/sonner';
import { LanguageSwitcher } from './language-switcher';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslocoPipe, NgIcon, HlmToaster, LanguageSwitcher],
  providers: [provideIcons({ lucideHexagon, lucideUsers, lucideLayoutDashboard })],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
