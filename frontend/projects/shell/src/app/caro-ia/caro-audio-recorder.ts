import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMic } from '@ng-icons/lucide';
import { HlmButton } from '@ui/button';
import { CaroVoiceRecorderService } from './caro-voice-recorder.service';

/**
 * Botón de micrófono del composer. Se mantiene presionado para hablar y se
 * suelta para terminar; el borrador con la onda vive dentro del composer.
 */
@Component({
  selector: 'app-caro-audio-recorder',
  imports: [HlmButton, NgIcon],
  providers: [provideIcons({ lucideMic })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      hlmBtn
      variant="ghost"
      size="icon-lg"
      type="button"
      class="touch-none rounded-full select-none"
      [class.text-destructive]="service.recording()"
      [class.opacity-50]="service.preparing() || service.reviewing()"
      [disabled]="disabled()"
      [attr.aria-label]="service.recording() ? stopLabel() : startLabel()"
      [attr.aria-pressed]="service.recording()"
      [attr.title]="service.recording() ? stopLabel() : startLabel()"
      data-testid="caro-audio-button"
      (pointerdown)="onPointerDown($event)"
      (pointerup)="onPointerUp($event)"
      (pointercancel)="onPointerUp($event)"
      (keydown)="onKeyDown($event)"
      (keyup)="onKeyUp($event)"
      (contextmenu)="$event.preventDefault()"
    >
      <ng-icon name="lucideMic" class="text-[length:--spacing(4.5)]" />
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

  protected onPointerDown(event: PointerEvent): void {
    if (this.disabled() || this.service.active()) {
      return;
    }

    event.preventDefault();

    const target = event.currentTarget;

    if (target instanceof HTMLElement) {
      try {
        target.setPointerCapture?.(event.pointerId);
      } catch {
        // El navegador puede rechazar la captura; el pointerup del botón sigue funcionando.
      }
    }

    this.started.emit();
    void this.service.start();
  }

  protected onPointerUp(event: PointerEvent): void {
    const target = event.currentTarget;

    if (target instanceof HTMLElement && target.hasPointerCapture?.(event.pointerId)) {
      try {
        target.releasePointerCapture(event.pointerId);
      } catch {
        // La captura ya se liberó al terminar el gesto.
      }
    }

    this.finishHold();
  }

  protected onKeyDown(event: KeyboardEvent): void {
    if (event.repeat || (event.key !== ' ' && event.key !== 'Enter')) {
      return;
    }

    if (this.disabled() || this.service.active()) {
      return;
    }

    event.preventDefault();
    this.started.emit();
    void this.service.start();
  }

  protected onKeyUp(event: KeyboardEvent): void {
    if (event.key !== ' ' && event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    this.finishHold();
  }

  private finishHold(): void {
    if (this.service.recording()) {
      this.service.stop();
      return;
    }

    if (this.service.preparing()) {
      this.service.cancel();
    }
  }
}
