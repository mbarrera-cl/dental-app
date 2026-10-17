import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideHexagon, lucideMenu, lucideSparkles, lucideX } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter, map, startWith } from 'rxjs';
import { HlmButton } from '@ui/button';
import { HlmToaster } from '@ui/sonner';
import { PERMISSION_KEYS, SessionStore } from 'auth';
import { ActivityMenu } from './activity/activity-menu';
import { BrandingStore } from './branding/branding-store';
import { LanguageSwitcher } from './language-switcher';
import { NavigationStore } from './navigation/navigation-store';
import { Sidebar } from './navigation/sidebar';
import { UserMenu } from './user-menu';

/** `clinic.name` default: the banner only invites while nobody renamed it. */
const DEFAULT_CLINIC_NAME = 'Mi clínica';
/** Dismissal flag; once set, the invitation never returns on this device. */
const ONBOARDING_KEY = 'hexa.onboarding.clinic.dismissed';

/**
 * Shell chrome: brand header (language + user menu) around the configurable
 * sidebar and the routed remote. The navigation links live in the database —
 * see `Sidebar` — so this component only toggles the mobile drawer. The
 * clinic branding (logo, name, slogan) comes from `BrandingStore`.
 *
 * Editors see a one-line invitation to configure the clinic while the
 * branding is still the shipped default; dismissing it is remembered.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, TranslocoPipe, NgIcon, HlmButton, HlmToaster, ActivityMenu, LanguageSwitcher, UserMenu, Sidebar],
  providers: [provideIcons({ lucideHexagon, lucideMenu, lucideSparkles, lucideX })],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly store = inject(SessionStore);
  protected readonly navigation = inject(NavigationStore);
  protected readonly branding = inject(BrandingStore);
  protected readonly keys = PERMISSION_KEYS;
  private readonly router = inject(Router);
  private readonly onboardingDismissed = signal(readOnboardingDismissed());

  /** CaroIA usa todo el ancho disponible; el resto de páginas conserva max-w-5xl. */
  protected readonly isCaroIa = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects.startsWith('/caro-ia')),
      startWith(this.router.url.startsWith('/caro-ia')),
    ),
    { initialValue: this.router.url.startsWith('/caro-ia') },
  );

  /**
   * Shown to users who can edit settings while the branding is untouched:
   * default name, no logo ever uploaded, default version.
   */
  protected readonly showOnboarding = computed(() => {
    const branding = this.branding.branding();

    return (
      !this.onboardingDismissed() &&
      this.store.has(PERMISSION_KEYS.settings.update) &&
      branding !== null &&
      branding.version === 0 &&
      branding.logoUrl === null &&
      branding.name === DEFAULT_CLINIC_NAME
    );
  });

  protected dismissOnboarding(): void {
    this.onboardingDismissed.set(true);

    try {
      localStorage.setItem(ONBOARDING_KEY, '1');
    } catch {
      // Unavailable storage (private mode): the banner returns next visit.
    }
  }
}

function readOnboardingDismissed(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === '1';
  } catch {
    return false;
  }
}
