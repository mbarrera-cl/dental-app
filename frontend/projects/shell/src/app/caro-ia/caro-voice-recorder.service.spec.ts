import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CaroVoiceRecorderService, type CaroVoiceError } from './caro-voice-recorder.service';

class FakeMediaRecorder {
  public static instances: FakeMediaRecorder[] = [];

  public state: RecordingState = 'inactive';
  public mimeType = 'audio/webm';
  public chunk: Blob | null = new Blob(['audio'], { type: 'audio/webm' });
  public ondataavailable: ((event: { data: Blob }) => void) | null = null;
  public onstop: (() => void) | null = null;

  public constructor(public readonly stream: MediaStream) {
    FakeMediaRecorder.instances.push(this);
  }

  public start(): void {
    this.state = 'recording';
  }

  public stop(): void {
    if (this.state === 'inactive') {
      return;
    }

    this.state = 'inactive';

    if (this.chunk !== null) {
      this.ondataavailable?.({ data: this.chunk });
    }

    this.onstop?.();
  }
}

class FakeAudioContext {
  public static instances: FakeAudioContext[] = [];
  public static amplitude = 0.4;

  public state = 'running';
  public readonly source = { connect: vi.fn(), disconnect: vi.fn() };
  public readonly analyser = {
    fftSize: 2048,
    getFloatTimeDomainData: vi.fn((data: Float32Array) => {
      for (let index = 0; index < data.length; index++) {
        data[index] = index % 2 === 0 ? FakeAudioContext.amplitude : -FakeAudioContext.amplitude;
      }
    }),
  };
  public readonly createMediaStreamSource = vi.fn(() => this.source);
  public readonly createAnalyser = vi.fn(() => this.analyser);
  public readonly resume = vi.fn(async () => undefined);
  public readonly close = vi.fn(async () => undefined);

  public constructor() {
    FakeAudioContext.instances.push(this);
  }
}

describe('CaroVoiceRecorderService', () => {
  let service: CaroVoiceRecorderService;
  let canvas: HTMLCanvasElement;
  let track: { stop: ReturnType<typeof vi.fn> };
  let stream: MediaStream;
  let getUserMedia: ReturnType<typeof vi.fn>;
  let intervalCallback: (() => void) | null;
  let rafCallback: FrameRequestCallback | null;
  let now: number;
  let errors: CaroVoiceError[];

  beforeEach(() => {
    FakeMediaRecorder.instances = [];
    FakeAudioContext.instances = [];
    FakeAudioContext.amplitude = 0.4;
    intervalCallback = null;
    rafCallback = null;
    now = 1_000;

    track = { stop: vi.fn() };
    stream = { getTracks: () => [track] } as unknown as MediaStream;
    getUserMedia = vi.fn(async () => stream);

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    vi.stubGlobal('AudioContext', FakeAudioContext);
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    vi.spyOn(window, 'setInterval').mockImplementation((handler) => {
      intervalCallback = typeof handler === 'function' ? (handler as () => void) : null;

      return 1;
    });
    vi.spyOn(window, 'clearInterval').mockImplementation(() => undefined);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      rafCallback = callback;

      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    canvas = {
      width: 1,
      height: 1,
      clientWidth: 400,
      clientHeight: 96,
      getContext: () => null,
    } as unknown as HTMLCanvasElement;

    TestBed.configureTestingModule({ providers: [CaroVoiceRecorderService] });
    service = TestBed.inject(CaroVoiceRecorderService);
    service.attachCanvas(canvas);
    errors = [];
    service.failed$.subscribe((error) => errors.push(error));
  });

  afterEach(() => {
    service.detach();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'mediaDevices');
  });

  it('records with MediaRecorder and tracks the elapsed time', async () => {
    await service.start();

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: {
        autoGainControl: false,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    expect(service.preparing()).toBe(false);
    expect(service.recording()).toBe(true);
    expect(FakeMediaRecorder.instances).toHaveLength(1);
    expect(FakeMediaRecorder.instances[0].state).toBe('recording');
    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(FakeAudioContext.instances[0].createAnalyser).toHaveBeenCalledOnce();

    now = 2_000;
    intervalCallback?.();
    expect(service.elapsedLabel()).toBe('00:01');

    now = 3_000;
    intervalCallback?.();
    expect(service.elapsedLabel()).toBe('00:02');
  });

  it('stops into review without transcribing until the user confirms', async () => {
    const blobs: Blob[] = [];
    service.recorded$.subscribe((blob) => blobs.push(blob));

    await service.start();
    service.stop();

    expect(blobs).toHaveLength(0);
    expect(service.recording()).toBe(false);
    expect(service.reviewing()).toBe(true);
    expect(service.active()).toBe(true);
    expect(track.stop).toHaveBeenCalledOnce();
    expect(FakeAudioContext.instances[0].close).toHaveBeenCalledOnce();

    service.confirm();

    expect(blobs).toHaveLength(1);
    expect(blobs[0].size).toBeGreaterThan(0);
    expect(blobs[0].type).toBe('audio/webm');
    expect(service.reviewing()).toBe(false);
    expect(service.active()).toBe(false);
  });

  it('discards the reviewed audio without emitting it', async () => {
    const blobs: Blob[] = [];
    service.recorded$.subscribe((blob) => blobs.push(blob));

    await service.start();
    service.stop();
    service.discard();

    expect(blobs).toHaveLength(0);
    expect(service.reviewing()).toBe(false);
    expect(service.active()).toBe(false);
    expect(service.elapsedLabel()).toBe('00:00');
  });

  it('discards the recording when the user cancels', async () => {
    const blobs: Blob[] = [];
    service.recorded$.subscribe((blob) => blobs.push(blob));

    await service.start();
    service.cancel();

    expect(blobs).toHaveLength(0);
    expect(service.recording()).toBe(false);
    expect(service.elapsedLabel()).toBe('00:00');
    expect(track.stop).toHaveBeenCalledOnce();
  });

  it('maps a denied microphone to a permission error', async () => {
    getUserMedia.mockRejectedValueOnce(new Error('Permission denied'));

    await service.start();

    expect(errors).toEqual(['permission']);
    expect(service.preparing()).toBe(false);
    expect(service.recording()).toBe(false);
    expect(FakeMediaRecorder.instances).toHaveLength(0);
  });

  it('rejects unsupported browsers before asking for the microphone', async () => {
    vi.stubGlobal('MediaRecorder', undefined);

    await service.start();

    expect(errors).toEqual(['unsupported']);
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('fails when the recording is empty', async () => {
    await service.start();
    FakeMediaRecorder.instances[0].chunk = null;
    service.stop();

    expect(errors).toEqual(['start']);
  });

  it('draws a growing waveform history from the microphone amplitude', async () => {
    const context = {
      clearRect: vi.fn(),
      fillStyle: '',
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
      fillRect: vi.fn(),
    };
    canvas = {
      width: 1,
      height: 1,
      clientWidth: 400,
      clientHeight: 96,
      getContext: () => context,
    } as unknown as HTMLCanvasElement;
    service.attachCanvas(canvas);

    FakeAudioContext.amplitude = 0.02;
    await service.start();
    const quiet = Math.max(...context.roundRect.mock.calls.map((call) => call[3] as number));

    context.roundRect.mockClear();
    now += 50;
    FakeAudioContext.amplitude = 0.4;
    rafCallback?.(0);
    const loud = Math.max(...context.roundRect.mock.calls.map((call) => call[3] as number));

    expect(context.roundRect).toHaveBeenCalled();
    expect(loud).toBeGreaterThan(quiet);
  });

  it('releases the microphone and ignores pending recordings on detach', async () => {
    const blobs: Blob[] = [];
    service.recorded$.subscribe((blob) => blobs.push(blob));

    await service.start();
    service.detach();

    expect(blobs).toHaveLength(0);
    expect(service.recording()).toBe(false);
    expect(track.stop).toHaveBeenCalledOnce();
    expect(FakeAudioContext.instances[0].close).toHaveBeenCalledOnce();
  });
});
