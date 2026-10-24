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

/** Cada cuánto se guarda una muestra de amplitud para dibujar la onda. */
const SAMPLE_INTERVAL_MS = 50;

/**
 * Grabación de voz con APIs nativas del navegador.
 *
 * `MediaRecorder` captura el audio y `AnalyserNode` alimenta una pequeña
 * historia de amplitudes. El canvas dibuja esa historia: en vivo se desplaza
 * y al soltar se congela completa para revisar antes de transcribir.
 */
@Injectable()
export class CaroVoiceRecorderService implements OnDestroy {
  private readonly recordingSignal = signal(false);
  private readonly preparingSignal = signal(false);
  private readonly reviewingSignal = signal(false);
  private readonly elapsedSignal = signal(0);

  private readonly recordedSubject = new Subject<Blob>();
  private readonly failedSubject = new Subject<CaroVoiceError>();

  readonly recording = this.recordingSignal.asReadonly();
  readonly preparing = this.preparingSignal.asReadonly();
  readonly reviewing = this.reviewingSignal.asReadonly();
  readonly active = computed(
    () => this.preparingSignal() || this.recordingSignal() || this.reviewingSignal(),
  );
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
  private history: number[] = [];
  private pendingBlob: Blob | null = null;
  private color = 'currentColor';
  private frame = 0;
  private timer: number | null = null;
  private startedAt = 0;
  private lastSampleAt = 0;
  private cancelled = false;
  private starting = false;
  private startToken = 0;
  private session = 0;

  /** El panel de voz entrega su canvas cuando aparece en el DOM. */
  attachCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.color = 'currentColor';
    this.resizeCanvas();
    this.clearCanvas();

    if (!this.recordingSignal() && this.history.length > 0) {
      this.drawPreview();
    }
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
    this.reviewingSignal.set(false);
    this.elapsedSignal.set(0);
    this.pendingBlob = null;
    this.chunks = [];
    this.history = [];
    this.clearCanvas();

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
      this.lastSampleAt = 0;
      this.timer = window.setInterval(() => this.tick(), 250);
      this.starting = false;
      this.frameLoop();
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

  /** Suelta el botón: termina la captura y deja el audio en revisión. */
  stop(): void {
    if (this.preparingSignal() && this.recorder === null) {
      this.cancel();
      return;
    }

    if (this.recorder !== null && this.recorder.state !== 'inactive') {
      this.tick();
      this.stopTimer();
      this.stopFrameLoop();
      this.recorder.stop();
    }
  }

  /** El check del composer: manda el audio a transcribir. */
  confirm(): void {
    const blob = this.pendingBlob;

    if (blob === null) {
      return;
    }

    this.pendingBlob = null;
    this.reviewingSignal.set(false);
    this.recordedSubject.next(blob);
  }

  /** La X del composer: descarta la grabación sin transcribirla. */
  discard(): void {
    this.reset();
  }

  /** Aborta una captura o una preparación pendiente. */
  cancel(): void {
    this.startToken += 1;
    this.starting = false;
    this.session += 1;
    this.cancelled = true;

    if (this.recorder !== null && this.recorder.state !== 'inactive') {
      try {
        this.recorder.stop();
      } catch {
        // El navegador ya había detenido la grabación.
      }
    }

    this.clearState();
  }

  /** Limpia el estado cuando la transcripción terminó o falló. */
  reset(): void {
    this.cancelled = false;
    this.clearState();
  }

  detach(): void {
    this.cancel();
    this.canvas = null;
  }

  ngOnDestroy(): void {
    this.detach();
  }

  private finish(recorder: MediaRecorder, session: number): void {
    if (session !== this.session) {
      return;
    }

    this.recordingSignal.set(false);
    this.preparingSignal.set(false);
    this.stopTimer();
    this.stopFrameLoop();

    const wasCancelled = this.cancelled;
    this.cancelled = false;
    const type = recorder.mimeType || 'audio/webm';
    const blob = new Blob(this.chunks, { type });
    this.chunks = [];

    if (wasCancelled) {
      this.clearState();
      return;
    }

    if (blob.size === 0) {
      this.fail('start');
      this.clearState();
      return;
    }

    this.pendingBlob = blob;
    this.reviewingSignal.set(true);
    this.drawPreview();
    this.cleanup();
  }

  private clearState(): void {
    this.pendingBlob = null;
    this.recordingSignal.set(false);
    this.preparingSignal.set(false);
    this.reviewingSignal.set(false);
    this.elapsedSignal.set(0);
    this.chunks = [];
    this.history = [];
    this.startedAt = 0;
    this.lastSampleAt = 0;
    this.stopTimer();
    this.stopFrameLoop();
    this.cleanup();
    this.clearCanvas();
  }

  private cleanup(): void {
    this.stopTimer();
    this.stopFrameLoop();

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
    if (this.startedAt === 0) {
      return;
    }

    this.elapsedSignal.set(Math.floor((Date.now() - this.startedAt) / 1000));
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private frameLoop = (): void => {
    this.sampleHistory();
    this.drawLive();
    this.frame = requestAnimationFrame(this.frameLoop);
  };

  private stopFrameLoop(): void {
    if (this.frame !== 0) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
  }

  private sampleHistory(): void {
    const analyser = this.analyser;

    if (analyser === null) {
      return;
    }

    const now = Date.now();

    if (this.lastSampleAt !== 0 && now - this.lastSampleAt < SAMPLE_INTERVAL_MS) {
      return;
    }

    this.lastSampleAt = now;
    analyser.getFloatTimeDomainData(this.samples);

    let peak = 0;

    for (let index = 0; index < this.samples.length; index++) {
      const value = Math.abs(this.samples[index]);

      if (value > peak) {
        peak = value;
      }
    }

    this.history.push(peak);
  }

  private drawLive(): void {
    const canvas = this.canvas;

    if (canvas === null) {
      return;
    }

    this.resizeCanvas();
    const count = this.barCount(canvas);
    const visible = this.history.slice(-count);
    const values = new Array<number>(count).fill(0);
    values.splice(count - visible.length, visible.length, ...visible);
    this.drawBars(values);
  }

  private drawPreview(): void {
    const canvas = this.canvas;

    if (canvas === null) {
      return;
    }

    this.resizeCanvas();
    const count = this.barCount(canvas);
    this.drawBars(this.downsample(this.history, count));
  }

  private drawBars(values: number[]): void {
    const canvas = this.canvas;

    if (canvas === null) {
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
    const count = this.barCount(canvas);
    const slot = width / count;
    const gap = Math.min(slot * 0.45, 2 * dpr);
    const barWidth = Math.max(1, slot - gap);
    const maxHeight = Math.max(1, height - 8 * dpr);
    const radius = Math.min(barWidth / 2, 2 * dpr);
    const canRound = typeof context.roundRect === 'function';

    context.clearRect(0, 0, width, height);

    if (values.length === 0) {
      return;
    }

    if (this.color === 'currentColor') {
      this.color = this.resolveColor();
    }

    context.fillStyle = this.color;

    for (let bar = 0; bar < values.length && bar < count; bar++) {
      const amplitude = Math.min(1, values[bar] * 2);
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
  }

  private downsample(values: number[], count: number): number[] {
    if (values.length === 0) {
      return [];
    }

    const result: number[] = [];

    for (let index = 0; index < count; index++) {
      const start = Math.floor((index * values.length) / count);
      const end = Math.max(start + 1, Math.floor(((index + 1) * values.length) / count));
      let peak = 0;

      for (let cursor = start; cursor < end && cursor < values.length; cursor++) {
        if (values[cursor] > peak) {
          peak = values[cursor];
        }
      }

      result.push(peak);
    }

    return result;
  }

  private barCount(canvas: HTMLCanvasElement): number {
    const dpr = window.devicePixelRatio || 1;

    return Math.max(20, Math.floor(canvas.width / (7 * dpr)));
  }

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
   * El canvas no resuelve variables CSS, pero sí hereda `color`. El panel
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
