import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideKeyRound,
  lucideLogOut,
  lucideLockKeyhole,
} from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmBadge } from '@ui/badge';
import { HlmButton } from '@ui/button';
import { HasPermissionDirective, PERMISSION_KEYS, SessionStore } from 'auth';
import { ChangePasswordDialog } from './change-password-dialog';
import { LanguageSwitcher } from './language-switcher';

/**
 * Header menu of the authenticated user: identity, role badges, shortcut to
 * the own API keys, password change and sign-out.
 */
@Component({
  selector: 'app-user-menu',
  imports: [
    RouterLink,
    NgIcon,
    TranslocoPipe,
    HlmBadge,
    HlmButton,
    HasPermissionDirective,
    ChangePasswordDialog,
    LanguageSwitcher,
  ],
  providers: [provideIcons({ lucideChevronDown, lucideKeyRound, lucideLogOut, lucideLockKeyhole })],
  templateUrl: './user-menu.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserMenu {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly router = inject(Router);

  protected readonly store = inject(SessionStore);
  protected readonly keys = PERMISSION_KEYS;
  protected readonly open = signal(false);
  protected readonly changePasswordOpen = signal(false);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  protected toggle(): void {
    this.open.update((value) => !value);
  }

  protected close(): void {
    this.open.set(false);
  }

  protected askChangePassword(): void {
    this.open.set(false);
    this.changePasswordOpen.set(true);
  }

  protected signOut(): void {
    this.store.logout().subscribe(() => void this.router.navigate(['/login']));
  }
}
