import { computed, signal, type Signal, type WritableSignal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideAppTransloco, provideSpartanHlm } from 'ui';
import { CaroVoiceRecorderService } from './caro-voice-recorder.service';
import { CaroVoiceWaveform } from './caro-voice-waveform';

describe('CaroVoiceWaveform', () => {
  let fixture: ComponentFixture<CaroVoiceWaveform>;
  let recording: WritableSignal<boolean>;
  let preparing: WritableSignal<boolean>;
  let service: {
    recording: Signal<boolean>;
    preparing: Signal<boolean>;
    active: Signal<boolean>;
    elapsedLabel: Signal<string>;
    attachCanvas: ReturnType<typeof vi.fn>;
    detach: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    recording = signal(false);
    preparing = signal(false);
    service = {
      recording: recording.asReadonly(),
      preparing: preparing.asReadonly(),
      active: computed(() => recording() || preparing()),
      elapsedLabel: computed(() => '00:03'),
      attachCanvas: vi.fn(),
      detach: vi.fn(),
      stop: vi.fn(),
      cancel: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [CaroVoiceWaveform],
      providers: [
        provideAppTransloco(),
        provideSpartanHlm(),
        { provide: CaroVoiceRecorderService, useValue: service },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CaroVoiceWaveform);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;

  it('mounts the canvas hidden until recording starts', () => {
    expect(host().classList.contains('invisible')).toBe(true);
    expect(host().querySelector('[data-testid="caro-voice-overlay"]')).not.toBeNull();
    expect(service.attachCanvas).toHaveBeenCalledOnce();

    const [canvas] = service.attachCanvas.mock.calls[0] as [HTMLCanvasElement];

    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
  });

  it('shows a skeleton while the microphone is being prepared', () => {
    preparing.set(true);
    fixture.detectChanges();

    expect(host().classList.contains('invisible')).toBe(false);
    expect(host().textContent).toContain('Preparando micrófono…');
    expect(host().querySelector('[hlmSkeleton]')).not.toBeNull();
  });

  it('shows the live wave and the stop/cancel controls while recording', () => {
    recording.set(true);
    fixture.detectChanges();

    expect(host().classList.contains('invisible')).toBe(false);
    expect(host().textContent).toContain('Escuchando…');
    expect(host().textContent).toContain('00:03');

    const stop = host().querySelector<HTMLButtonElement>('[data-testid="caro-voice-stop"]');
    const cancel = host().querySelector<HTMLButtonElement>('[data-testid="caro-voice-cancel"]');

    stop?.click();
    cancel?.click();

    expect(service.stop).toHaveBeenCalledOnce();
    expect(service.cancel).toHaveBeenCalledOnce();
  });

  it('stays visible while the audio is being transcribed', () => {
    fixture.componentRef.setInput('transcribing', true);
    fixture.detectChanges();

    expect(host().classList.contains('invisible')).toBe(false);
    expect(host().textContent).toContain('Transcribiendo audio…');
    expect(host().querySelector('[data-testid="caro-voice-stop"]')).toBeNull();
  });

  it('disappears when the transcription finishes', () => {
    recording.set(true);
    fixture.componentRef.setInput('transcribing', true);
    fixture.detectChanges();

    recording.set(false);
    fixture.componentRef.setInput('transcribing', false);
    fixture.detectChanges();

    expect(host().classList.contains('invisible')).toBe(true);
  });

  it('detaches the canvas when the overlay is destroyed', () => {
    fixture.destroy();

    expect(service.detach).toHaveBeenCalledOnce();
  });
});
