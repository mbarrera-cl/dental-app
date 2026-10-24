import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterLink,
  RouterOutlet,
} from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideHexagon, lucideMenu, lucideSparkles, lucideX } from '@ng-icons/lucide';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { interval } from 'rxjs';
import { HlmButton } from '@ui/button';
import { HlmToaster } from '@ui/sonner';
import { PERMISSION_KEYS, SessionStore } from 'auth';
import type { MenuItem } from 'data-access';
import { ActivityMenu } from './activity/activity-menu';
import { BrandingStore } from './branding/branding-store';
import { LanguageSwitcher } from './language-switcher';
import { NavigationStore } from './navigation/navigation-store';
import { resolveRoute } from './navigation/route-registry';
import { Sidebar } from './navigation/sidebar';
import { UserMenu } from './user-menu';

/** `clinic.name` default: the banner only invites while nobody renamed it. */
const DEFAULT_CLINIC_NAME = 'Mi clínica';
/** Dismissal flag; once set, the invitation never returns on this device. */
const ONBOARDING_KEY = 'hexa.onboarding.clinic.dismissed';

interface SectionMatch {
  readonly label: string;
  readonly group: string | null;
}

/**
 * Shell chrome: the clinic's identity, a quiet "dayline" with the current date
 * and the active section, the database-driven sidebar and the routed remote.
 *
 * Orientation is the product: the header answers "where am I?" before it shows
 * any action, the sidebar keeps the active section marked, and a failed remote
 * is a designed state with a retry instead of an unhandled rejection.
 */
@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    TranslocoPipe,
    NgIcon,
    HlmButton,
    HlmToaster,
    ActivityMenu,
    LanguageSwitcher,
    UserMenu,
    Sidebar,
  ],
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
  private readonly transloco = inject(TranslocoService);
  private readonly onboardingDismissed = signal(readOnboardingDismissed());
  private readonly clock = signal(new Date());

  /** Current URL after redirects; drives the full-bleed surfaces. */
  private readonly currentUrl = signal(this.router.url);
  /** URL of the navigation in flight, used by the retry action. */
  private readonly pendingUrl = signal(this.router.url);

  protected readonly isCaroIa = computed(() => this.currentUrl().startsWith('/caro-ia'));
  protected readonly isAgenda = computed(() => this.currentUrl().startsWith('/agenda'));
  /** The login screen owns its own chrome: no shell header or footer. */
  protected readonly isLogin = computed(() => this.currentUrl().startsWith('/login'));
  protected readonly isFullBleed = computed(
    () => this.isCaroIa() || this.isAgenda() || this.isLogin(),
  );

  /** True while the router is resolving a route (including lazy remotes). */
  protected readonly navigating = signal(false);
  /** True when the router could not load the target route. */
  protected readonly navigationError = signal(false);

  /** Re-resolves menu labels whenever the shared language changes. */
  private readonly activeLang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  private readonly sectionIndex = computed(() => {
    this.activeLang();
    const index = new Map<string, SectionMatch>();

    const walk = (items: readonly MenuItem[], group: string | null): void => {
      for (const item of items) {
        const route = item.routeKey === null ? undefined : resolveRoute(item.routeKey);
        const label: string =
          item.label ?? (route === undefined ? '' : (this.transloco.translate(route.label) ?? ''));

        if (item.kind === 'item' && route !== undefined) {
          index.set(route.path, { label, group });
        }

        if (item.children.length > 0) {
          walk(item.children, item.kind === 'group' ? label || group : group);
        }
      }
    };

    walk(this.navigation.tree(), null);

    return index;
  });

  private readonly sectionMatch = computed<SectionMatch | null>(() => {
    const path = this.currentUrl();
    let match: SectionMatch | null = null;
    let length = -1;

    for (const [routePath, section] of this.sectionIndex()) {
      if (path === routePath || path.startsWith(`${routePath}/`)) {
        if (routePath.length > length) {
          length = routePath.length;
          match = section;
        }
      }
    }

    return match;
  });

  protected readonly sectionLabel = computed(() => {
    const match = this.sectionMatch();

    if (match !== null) {
      return match.label;
    }

    if (this.currentUrl().startsWith('/activity')) {
      this.activeLang();
      return this.transloco.translate('activity.title');
    }

    return null;
  });

  protected readonly sectionGroup = computed(() => this.sectionMatch()?.group ?? null);

  protected readonly today = computed(() => {
    const now = this.clock();

    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    }).format(now);
  });

  protected readonly time = computed(() => {
    const now = this.clock();

    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);
  });

  constructor() {
    interval(60_000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.clock.set(new Date()));

    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.navigating.set(true);
        this.navigationError.set(false);
        this.pendingUrl.set(event.url);
      } else if (event instanceof NavigationEnd) {
        this.navigating.set(false);
        this.currentUrl.set(event.urlAfterRedirects);
      } else if (event instanceof NavigationCancel) {
        this.navigating.set(false);
      } else if (event instanceof NavigationError) {
        this.navigating.set(false);
        this.navigationError.set(true);
      }
    });
  }

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

  protected retryNavigation(): void {
    // Native Federation keeps a failed remote marked as "not initialized" for
    // the lifetime of the document, so a client-side retry cannot recover it:
    // reload the target URL to rebuild the federation runtime.
    window.location.assign(this.pendingUrl());
  }
}

function readOnboardingDismissed(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === '1';
  } catch {
    return false;
  }
}
