import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMic, lucideSquare } from '@ng-icons/lucide';
import { HlmButton } from '@ui/button';
import { CaroVoiceRecorderService } from './caro-voice-recorder.service';

/**
 * Botón de micrófono del composer. El estado y el motor de audio viven en
 * `CaroVoiceRecorderService`, compartido con el overlay que se muestra en el
 * centro del chat.
 */
@Component({
  selector: 'app-caro-audio-recorder',
  imports: [HlmButton, NgIcon],
  providers: [provideIcons({ lucideMic, lucideSquare })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      hlmBtn
      variant="ghost"
      size="icon-lg"
      type="button"
      class="rounded-full"
      [class.text-destructive]="service.recording()"
      [class.w-auto]="service.recording()"
      [class.px-3]="service.recording()"
      [disabled]="disabled() || service.preparing()"
      [attr.aria-label]="service.recording() ? stopLabel() : startLabel()"
      [attr.title]="service.recording() ? stopLabel() : startLabel()"
      data-testid="caro-audio-button"
      (click)="toggle()"
    >
      @if (service.recording()) {
        <span class="relative flex items-center gap-1.5">
          <span class="bg-destructive size-2 animate-pulse rounded-full"></span>
          <span class="text-destructive text-xs font-medium tabular-nums">
            {{ service.elapsedLabel() }}
          </span>
          <ng-icon name="lucideSquare" class="text-[length:--spacing(3.5)]" />
        </span>
      } @else {
        <ng-icon name="lucideMic" class="text-[length:--spacing(4.5)]" />
      }
    </button>
  `,
})
export class CaroAudioRecorder {
  protected readonly service = inject(CaroVoiceRecorderService);

  public readonly disabled = input(false);
  public readonly startLabel = input('Grabar audio');
  public readonly stopLabel = input('Detener grabación');

  /** Se emite antes de pedir micrófono, para limpiar errores previos. */
  public readonly started = output<void>();

  protected toggle(): void {
    if (this.service.recording()) {
      this.service.stop();
      return;
    }

    this.started.emit();
    void this.service.start();
  }
}
