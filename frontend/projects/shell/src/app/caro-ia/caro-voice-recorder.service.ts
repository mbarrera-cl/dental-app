import { computed, Injectable, OnDestroy, signal } from '@angular/core';
import { Subject } from 'rxjs';

/** Errores que la página traduce a un mensaje para el usuario. */
export type CaroVoiceError = 'unsupported' | 'permission' | 'start';

/**
 * Sin `autoGainControl` la onda refleja mejor la amplitud real de la voz.
 * El resto son filtros normales de una llamada.
 */
const AUDIO_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    autoGainControl: false,
    echoCancellation: true,
    noiseSuppression: true,
  },
};

/**
 * Grabación de voz con APIs nativas del navegador.
 *
 * `MediaRecorder` captura el audio que luego se transcribe y `AnalyserNode`
 * entrega el frame actual para dibujarlo en un `<canvas>`. Cada frame
 * reemplaza al anterior: la onda es fija y no acumula lo ya hablado.
 */
@Injectable()
export class CaroVoiceRecorderService implements OnDestroy {
  private readonly recordingSignal = signal(false);
  private readonly preparingSignal = signal(false);
  private readonly elapsedSignal = signal(0);

  private readonly recordedSubject = new Subject<Blob>();
  private readonly failedSubject = new Subject<CaroVoiceError>();

  readonly recording = this.recordingSignal.asReadonly();
  readonly preparing = this.preparingSignal.asReadonly();
  readonly active = computed(() => this.preparingSignal() || this.recordingSignal());
  readonly elapsedLabel = computed(() => formatElapsed(this.elapsedSignal()));
  readonly recorded$ = this.recordedSubject.asObservable();
  readonly failed$ = this.failedSubject.asObservable();

  private canvas: HTMLCanvasElement | null = null;
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private chunks: BlobPart[] = [];
  private samples = new Float32Array(2048);
  private color = 'currentColor';
  private frame = 0;
  private timer: number | null = null;
  private startedAt = 0;
  private cancelled = false;
  private starting = false;
  private startToken = 0;
  private session = 0;

  /** El overlay entrega su canvas cuando aparece en el DOM. */
  attachCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.resizeCanvas();
    this.clearCanvas();
  }

  async start(): Promise<void> {
    if (this.starting || this.active()) {
      return;
    }

    if (!this.isSupported()) {
      this.fail('unsupported');
      return;
    }

    const token = ++this.startToken;
    this.cancelled = false;
    this.starting = true;
    this.preparingSignal.set(true);
    this.elapsedSignal.set(0);
    this.chunks = [];

    let stream: MediaStream | null = null;
    let recorder: MediaRecorder | null = null;
    let audioContext: AudioContext | null = null;

    try {
      // El AudioContext se crea dentro del gesto del click para que iOS no lo
      // deje suspendido después del prompt de permisos.
      audioContext = new AudioContext();
      const resumed = audioContext.resume();
      stream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
      await resumed;

      if (token !== this.startToken) {
        stopStream(stream);
        void audioContext.close().catch(() => undefined);
        return;
      }

      recorder = new MediaRecorder(stream);
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      this.stream = stream;
      this.recorder = recorder;
      this.audioContext = audioContext;
      this.source = source;
      this.analyser = analyser;
      this.samples = new Float32Array(analyser.fftSize);
      this.color = this.resolveColor();
      this.session += 1;
      const session = this.session;
      const activeRecorder = recorder;

      activeRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };
      activeRecorder.onstop = () => this.finish(activeRecorder, session);
      activeRecorder.start();

      this.preparingSignal.set(false);
      this.recordingSignal.set(true);
      this.startedAt = Date.now();
      this.timer = window.setInterval(() => this.tick(), 250);
      this.starting = false;
      this.drawFrame();
    } catch (error) {
      if (token !== this.startToken) {
        if (stream !== null) {
          stopStream(stream);
        }

        if (audioContext !== null) {
          void audioContext.close().catch(() => undefined);
        }

        return;
      }

      if (this.stream !== stream && stream !== null) {
        stopStream(stream);
      }

      if (this.audioContext !== audioContext && audioContext !== null) {
        void audioContext.close().catch(() => undefined);
      }

      this.starting = false;
      this.preparingSignal.set(false);
      this.recordingSignal.set(false);
      this.cleanup();
      this.fail(isPermissionError(error) ? 'permission' : 'start');
    }
  }

  stop(): void {
    this.stopTimer();

    if (this.recorder !== null && this.recorder.state !== 'inactive') {
      this.recorder.stop();
      return;
    }

    this.cleanup();
    this.recordingSignal.set(false);
    this.preparingSignal.set(false);
  }

  cancel(): void {
    this.session += 1;
    this.cancelled = true;
    this.recordingSignal.set(false);
    this.preparingSignal.set(false);
    this.elapsedSignal.set(0);
    this.stopTimer();

    if (this.recorder !== null && this.recorder.state !== 'inactive') {
      try {
        this.recorder.stop();
      } catch {
        // El navegador ya había detenido la grabación.
      }
    }

    // En una cancelación no hace falta esperar al blob: liberamos ya el
    // micrófono y el `onstop` tardío se descarta por sesión.
    this.cleanup();
    this.clearCanvas();
  }

  /** Limpia el estado una vez que la transcripción terminó o falló. */
  reset(): void {
    this.recordingSignal.set(false);
    this.preparingSignal.set(false);
    this.elapsedSignal.set(0);
    this.cancelled = false;
    this.stopTimer();
    this.clearCanvas();
  }

  detach(): void {
    this.startToken += 1;
    this.session += 1;
    this.starting = false;
    this.cancelled = true;
    this.recordingSignal.set(false);
    this.preparingSignal.set(false);
    this.elapsedSignal.set(0);
    this.stopTimer();

    if (this.recorder !== null && this.recorder.state !== 'inactive') {
      try {
        this.recorder.stop();
      } catch {
        // El navegador ya había detenido la grabación.
      }
    }

    this.cleanup();
    this.canvas = null;
  }

  ngOnDestroy(): void {
    this.detach();
  }

  private finish(recorder: MediaRecorder, session: number): void {
    if (session !== this.session) {
      return;
    }

    this.stopTimer();
    this.recordingSignal.set(false);
    this.preparingSignal.set(false);

    const wasCancelled = this.cancelled;
    this.cancelled = false;
    const type = recorder.mimeType || 'audio/webm';
    const blob = new Blob(this.chunks, { type });
    this.chunks = [];
    this.cleanup();

    if (wasCancelled) {
      this.clearCanvas();
      return;
    }

    if (blob.size === 0) {
      this.fail('start');
      this.clearCanvas();
      return;
    }

    this.recordedSubject.next(blob);
  }

  private cleanup(): void {
    this.stopTimer();

    if (this.frame !== 0) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }

    if (this.stream !== null) {
      stopStream(this.stream);
    }

    this.source?.disconnect();

    if (this.audioContext !== null) {
      void this.audioContext.close().catch(() => undefined);
    }

    this.stream = null;
    this.recorder = null;
    this.audioContext = null;
    this.source = null;
    this.analyser = null;
  }

  private tick(): void {
    this.elapsedSignal.set(Math.floor((Date.now() - this.startedAt) / 1000));
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private drawFrame = (): void => {
    const canvas = this.canvas;
    const analyser = this.analyser;

    if (canvas === null || analyser === null) {
      return;
    }

    this.resizeCanvas();
    const context = canvas.getContext('2d');

    if (context === null) {
      return;
    }

    const width = canvas.width;
    const height = canvas.height;
    const dpr = window.devicePixelRatio || 1;
    const bars = Math.max(20, Math.floor(width / (7 * dpr)));
    const perBar = Math.max(1, Math.floor(this.samples.length / bars));
    const slot = width / bars;
    const gap = Math.min(slot * 0.45, 2 * dpr);
    const barWidth = Math.max(1, slot - gap);
    const maxHeight = Math.max(1, height - 8 * dpr);
    const radius = Math.min(barWidth / 2, 2 * dpr);
    const canRound = typeof context.roundRect === 'function';

    analyser.getFloatTimeDomainData(this.samples);
    context.clearRect(0, 0, width, height);
    context.fillStyle = this.color;

    for (let bar = 0; bar < bars; bar++) {
      let peak = 0;
      const start = bar * perBar;
      const end = Math.min(this.samples.length, start + perBar);

      for (let index = start; index < end; index++) {
        const value = Math.abs(this.samples[index]);

        if (value > peak) {
          peak = value;
        }
      }

      // La ganancia sólo hace visible la voz normal; la altura sigue siendo
      // proporcional a la amplitud real del frame.
      const amplitude = Math.min(1, peak * 2);
      const barHeight = Math.max(2 * dpr, amplitude * maxHeight);
      const x = bar * slot + gap / 2;
      const y = (height - barHeight) / 2;

      if (canRound) {
        context.beginPath();
        context.roundRect(x, y, barWidth, barHeight, radius);
        context.fill();
      } else {
        context.fillRect(x, y, barWidth, barHeight);
      }
    }

    this.frame = requestAnimationFrame(this.drawFrame);
  };

  private resizeCanvas(): void {
    if (this.canvas === null) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const height = Math.max(1, Math.round(this.canvas.clientHeight * dpr));

    if (this.canvas.width !== width) {
      this.canvas.width = width;
    }

    if (this.canvas.height !== height) {
      this.canvas.height = height;
    }
  }

  private clearCanvas(): void {
    if (this.canvas === null) {
      return;
    }

    const context = this.canvas.getContext('2d');
    context?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private isSupported(): boolean {
    return (
      typeof MediaRecorder !== 'undefined' &&
      typeof AudioContext !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices?.getUserMedia !== undefined
    );
  }

  private fail(error: CaroVoiceError): void {
    this.failedSubject.next(error);
  }

  /**
   * El canvas no resuelve variables CSS, pero sí hereda `color`. El overlay
   * le aplica `text-primary` y aquí se obtiene el color concreto del tema.
   */
  private resolveColor(): string {
    if (this.canvas === null) {
      return 'currentColor';
    }

    try {
      return getComputedStyle(this.canvas).color || 'currentColor';
    } catch {
      return 'currentColor';
    }
  }
}

function stopStream(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}

function isPermissionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);

  return /permission|notallowed|denied/i.test(message);
}

function formatElapsed(total: number): string {
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (total % 60).toString().padStart(2, '0');

  return `${minutes}:${seconds}`;
}
