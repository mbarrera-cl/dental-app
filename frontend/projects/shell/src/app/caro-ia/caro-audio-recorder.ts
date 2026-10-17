import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  OnDestroy,
  output,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMic, lucideSquare } from '@ng-icons/lucide';
import { HlmButton } from '@ui/button';

/**
 * Grabador de voz del composer. Graba con `MediaRecorder`, muestra el tiempo
 * y emite el Blob al detenerse. La transcripción la hace el gateway (mock en
 * esta rama, Deepgram en la rama backend).
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
      [class.text-destructive]="recording()"
      [disabled]="disabled()"
      [attr.aria-label]="recording() ? stopLabel() : startLabel()"
      [attr.title]="recording() ? stopLabel() : startLabel()"
      data-testid="caro-audio-button"
      (click)="toggle()"
    >
      @if (recording()) {
        <span class="relative flex items-center gap-1.5">
          <span class="bg-destructive size-2 animate-pulse rounded-full"></span>
          <span class="text-destructive text-xs font-medium tabular-nums">{{ elapsedLabel() }}</span>
          <ng-icon name="lucideSquare" class="text-[length:--spacing(3.5)]" />
        </span>
      } @else {
        <ng-icon name="lucideMic" class="text-[length:--spacing(4.5)]" />
      }
    </button>
    @if (error(); as message) {
      <span class="text-destructive text-xs" role="alert">{{ message }}</span>
    }
  `,
})
export class CaroAudioRecorder implements OnDestroy {
  public readonly disabled = input(false);
  public readonly startLabel = input('Grabar audio');
  public readonly stopLabel = input('Detener grabación');
  public readonly unsupportedMessage = input('Tu navegador no permite grabar audio.');
  public readonly permissionMessage = input('No se pudo acceder al micrófono.');

  public readonly recorded = output<Blob>();
  public readonly failed = output<string>();

  protected readonly recording = signal(false);
  protected readonly elapsed = signal(0);
  protected readonly error = signal<string | null>(null);
  protected readonly elapsedLabel = computed(() => {
    const total = this.elapsed();
    const minutes = Math.floor(total / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (total % 60).toString().padStart(2, '0');

    return `${minutes}:${seconds}`;
  });

  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  async toggle(): Promise<void> {
    if (this.recording()) {
      this.stop();

      return;
    }

    await this.start();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  private async start(): Promise<void> {
    this.error.set(null);

    if (
      typeof MediaRecorder === 'undefined' ||
      navigator.mediaDevices?.getUserMedia === undefined
    ) {
      const message = this.unsupportedMessage();
      this.error.set(message);
      this.failed.emit(message);

      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.chunks = [];
      this.mediaRecorder = new MediaRecorder(this.stream);
      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, {
          type: this.mediaRecorder?.mimeType || 'audio/webm',
        });

        this.cleanup();
        this.recorded.emit(blob);
      };
      this.mediaRecorder.start();
      this.recording.set(true);
      this.elapsed.set(0);
      this.timer = setInterval(() => this.elapsed.update((value) => value + 1), 1000);
    } catch {
      const message = this.permissionMessage();
      this.error.set(message);
      this.failed.emit(message);
      this.cleanup();
    }
  }

  private stop(): void {
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.stop();
    } else {
      this.cleanup();
    }

    this.recording.set(false);
  }

  private cleanup(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.mediaRecorder = null;
    this.recording.set(false);
  }
}
