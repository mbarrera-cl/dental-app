import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  OnDestroy,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMic, lucideSquare } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@ui/button';
import { HlmSkeleton } from '@ui/skeleton';
import { HlmSpinner } from '@ui/spinner';
import { CaroVoiceRecorderService } from './caro-voice-recorder.service';

/**
 * Overlay de grabación que se muestra en el centro del chat. El canvas dibuja
 * sólo el frame actual del AnalyserNode; lo que ya se habló no se acumula.
 */
@Component({
  selector: 'app-caro-voice-waveform',
  imports: [NgIcon, TranslocoPipe, HlmButton, HlmSkeleton, HlmSpinner],
  providers: [provideIcons({ lucideMic, lucideSquare })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'absolute inset-0 z-30 flex items-center justify-center p-4 transition-opacity duration-150',
    '[class.invisible]': '!visible()',
    '[class.opacity-0]': '!visible()',
    '[class.pointer-events-none]': '!visible()',
    '[class.opacity-100]': 'visible()',
    '[class.pointer-events-auto]': 'visible()',
  },
  template: `
    <div class="bg-background/60 absolute inset-0 backdrop-blur-[2px]"></div>

    <section
      class="bg-card text-card-foreground relative w-full max-w-md rounded-lg border p-5 shadow-lg"
      role="dialog"
      aria-labelledby="caro-voice-title"
      [attr.aria-busy]="transcribing()"
      data-testid="caro-voice-overlay"
    >
      <div class="flex items-center gap-3">
        <span
          class="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full"
        >
          @if (transcribing()) {
            <hlm-spinner class="text-[length:--spacing(5)]" />
          } @else {
            <ng-icon name="lucideMic" class="text-[length:--spacing(5)]" />
          }
        </span>

        <div class="min-w-0 flex-1">
          <h2 id="caro-voice-title" class="text-sm font-semibold">
            {{ 'caroIa.audio.voiceTitle' | transloco }}
          </h2>
          <p class="text-muted-foreground text-xs" aria-live="polite">
            {{ statusKey() | transloco }}
          </p>
        </div>

        <span class="text-muted-foreground text-xs font-medium tabular-nums">
          {{ service.elapsedLabel() }}
        </span>
      </div>

      <div
        class="bg-muted/30 relative mt-4 h-24 overflow-hidden rounded-md border"
        aria-hidden="true"
      >
        <canvas #waveform class="text-primary block h-full w-full"></canvas>

        @if (service.preparing() && !service.recording()) {
          <div class="absolute inset-0 flex items-center gap-1 p-3">
            @for (bar of skeletonBars; track $index) {
              <span hlmSkeleton class="w-full flex-1 rounded-full" [style.height.%]="bar"></span>
            }
          </div>
        }

        @if (transcribing()) {
          <div class="bg-background/50 absolute inset-0 flex items-center justify-center">
            <span class="text-muted-foreground flex items-center gap-2 text-xs">
              <hlm-spinner />
              {{ 'caroIa.audio.transcribing' | transloco }}
            </span>
          </div>
        }
      </div>

      @if (service.recording()) {
        <div class="mt-4 flex items-center justify-end gap-2">
          <button
            hlmBtn
            variant="ghost"
            type="button"
            data-testid="caro-voice-cancel"
            (click)="cancel()"
          >
            {{ 'caroIa.audio.cancel' | transloco }}
          </button>
          <button
            hlmBtn
            variant="destructive"
            type="button"
            data-testid="caro-voice-stop"
            (click)="stop()"
          >
            <ng-icon name="lucideSquare" />
            {{ 'caroIa.audio.stopShort' | transloco }}
          </button>
        </div>
      }
    </section>
  `,
})
export class CaroVoiceWaveform implements OnDestroy {
  protected readonly service = inject(CaroVoiceRecorderService);
  private readonly waveform = viewChild.required<ElementRef<HTMLCanvasElement>>('waveform');

  public readonly transcribing = input(false);

  protected readonly visible = computed(() => this.service.active() || this.transcribing());
  protected readonly statusKey = computed(() => {
    if (this.transcribing()) {
      return 'caroIa.audio.transcribing';
    }

    if (this.service.preparing()) {
      return 'caroIa.audio.preparing';
    }

    return 'caroIa.audio.listening';
  });
  protected readonly skeletonBars = [32, 58, 44, 72, 38, 84, 50, 64, 34, 76, 42, 60, 46, 68, 36];

  constructor() {
    afterNextRender(() => {
      this.service.attachCanvas(this.waveform().nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.service.detach();
  }

  protected stop(): void {
    this.service.stop();
  }

  protected cancel(): void {
    this.service.cancel();
  }
}
