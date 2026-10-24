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
import { lucideMic } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmSkeleton } from '@ui/skeleton';
import { HlmSpinner } from '@ui/spinner';
import { CaroVoiceRecorderService } from './caro-voice-recorder.service';

/**
 * Panel de voz que vive dentro del composer. Mientras se habla muestra la
 * onda en vivo; al soltar queda congelada para confirmarla o descartarla.
 */
@Component({
  selector: 'app-caro-voice-waveform',
  imports: [NgIcon, TranslocoPipe, HlmSkeleton, HlmSpinner],
  providers: [provideIcons({ lucideMic })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full' },
  template: `
    <div class="block w-full" data-testid="caro-voice-draft">
      <div class="mb-1.5 flex items-center gap-2 px-0.5">
        <span
          class="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-full"
        >
          <ng-icon name="lucideMic" class="text-[length:--spacing(4)]" />
        </span>

        <p class="text-foreground min-w-0 flex-1 truncate text-xs font-medium" aria-live="polite">
          {{ statusKey() | transloco }}
        </p>

        <span class="text-muted-foreground text-xs font-medium tabular-nums">
          {{ service.elapsedLabel() }}
        </span>
      </div>

      <div class="bg-muted/20 relative h-20 overflow-hidden rounded-lg sm:h-24" aria-hidden="true">
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
            <hlm-spinner class="text-[length:--spacing(5)]" />
          </div>
        }
      </div>
    </div>
  `,
})
export class CaroVoiceWaveform implements OnDestroy {
  protected readonly service = inject(CaroVoiceRecorderService);
  private readonly waveform = viewChild.required<ElementRef<HTMLCanvasElement>>('waveform');

  public readonly transcribing = input(false);

  protected readonly statusKey = computed(() => {
    if (this.transcribing()) {
      return 'caroIa.audio.transcribing';
    }

    if (this.service.preparing()) {
      return 'caroIa.audio.preparing';
    }

    if (this.service.reviewing()) {
      return 'caroIa.audio.review';
    }

    return 'caroIa.audio.releaseToStop';
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
}
