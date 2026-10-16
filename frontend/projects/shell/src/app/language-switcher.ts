import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLanguages } from '@ng-icons/lucide';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LANGUAGES, rememberLanguage, type Language } from 'ui';

/**
 * Language switcher rendered in the shell header. Updates the shared
 * Transloco singleton (remotes re-render too) and persists the choice in
 * `localStorage`.
 */
@Component({
  selector: 'app-language-switcher',
  imports: [NgIcon, TranslocoPipe],
  providers: [provideIcons({ lucideLanguages })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="border-input inline-flex items-center rounded-md border p-0.5"
      role="group"
      [attr.aria-label]="'common.language' | transloco"
    >
      <ng-icon name="lucideLanguages" class="text-muted-foreground mx-1.5 text-sm" aria-hidden="true" />
      @for (language of languages; track language) {
        <button
          type="button"
          class="rounded-[5px] px-2 py-0.5 text-xs font-medium transition-colors"
          [class]="
            language === activeLanguage()
              ? 'bg-secondary text-secondary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          "
          [attr.aria-pressed]="language === activeLanguage()"
          (click)="select(language)"
        >
          {{ language.toUpperCase() }}
        </button>
      }
    </div>
  `,
})
export class LanguageSwitcher {
  protected readonly languages = LANGUAGES;

  private readonly transloco = inject(TranslocoService);

  protected readonly activeLanguage = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected select(language: Language): void {
    this.transloco.setActiveLang(language);
    rememberLanguage(language);
  }
}
