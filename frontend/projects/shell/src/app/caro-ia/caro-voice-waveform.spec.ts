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
  let reviewing: WritableSignal<boolean>;
  let service: {
    recording: Signal<boolean>;
    preparing: Signal<boolean>;
    reviewing: Signal<boolean>;
    elapsedLabel: Signal<string>;
    attachCanvas: ReturnType<typeof vi.fn>;
    detach: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    recording = signal(false);
    preparing = signal(false);
    reviewing = signal(false);
    service = {
      recording: recording.asReadonly(),
      preparing: preparing.asReadonly(),
      reviewing: reviewing.asReadonly(),
      elapsedLabel: computed(() => '00:03'),
      attachCanvas: vi.fn(),
      detach: vi.fn(),
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

  it('mounts the inline draft and its canvas inside the composer', () => {
    expect(host().querySelector('[data-testid="caro-voice-draft"]')).not.toBeNull();
    expect(service.attachCanvas).toHaveBeenCalledOnce();

    const [canvas] = service.attachCanvas.mock.calls[0] as [HTMLCanvasElement];

    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
  });

  it('shows a skeleton while the microphone is being prepared', () => {
    preparing.set(true);
    fixture.detectChanges();

    expect(host().textContent).toContain('Preparando micrófono…');
    expect(host().querySelector('[hlmSkeleton]')).not.toBeNull();
  });

  it('shows the live wave and the release hint while recording', () => {
    recording.set(true);
    fixture.detectChanges();

    expect(host().textContent).toContain('Suelta para detener');
    expect(host().textContent).toContain('00:03');
    expect(host().querySelector('[hlmSkeleton]')).toBeNull();
  });

  it('freezes into a review message after releasing', () => {
    reviewing.set(true);
    fixture.detectChanges();

    expect(host().textContent).toContain('¿Transcribir este audio?');
    expect(host().textContent).toContain('00:03');
  });

  it('stays visible and shows the transcribing status', () => {
    fixture.componentRef.setInput('transcribing', true);
    fixture.detectChanges();

    expect(host().textContent).toContain('Transcribiendo audio…');
    expect(host().querySelector('[data-testid="caro-voice-draft"]')).not.toBeNull();
    expect(host().querySelector('hlm-spinner')).not.toBeNull();
  });

  it('detaches the canvas when the composer draft is destroyed', () => {
    fixture.destroy();

    expect(service.detach).toHaveBeenCalledOnce();
  });
});
