import { computed, signal, type Signal, type WritableSignal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideSpartanHlm } from 'ui';
import { CaroAudioRecorder } from './caro-audio-recorder';
import { CaroVoiceRecorderService } from './caro-voice-recorder.service';

describe('CaroAudioRecorder', () => {
  let fixture: ComponentFixture<CaroAudioRecorder>;
  let recording: WritableSignal<boolean>;
  let preparing: WritableSignal<boolean>;
  let reviewing: WritableSignal<boolean>;
  let service: {
    recording: Signal<boolean>;
    preparing: Signal<boolean>;
    reviewing: Signal<boolean>;
    active: Signal<boolean>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    recording = signal(false);
    preparing = signal(false);
    reviewing = signal(false);
    service = {
      recording: recording.asReadonly(),
      preparing: preparing.asReadonly(),
      reviewing: reviewing.asReadonly(),
      active: computed(() => recording() || preparing() || reviewing()),
      start: vi.fn(async () => undefined),
      stop: vi.fn(),
      cancel: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [CaroAudioRecorder],
      providers: [provideSpartanHlm(), { provide: CaroVoiceRecorderService, useValue: service }],
    }).compileComponents();

    fixture = TestBed.createComponent(CaroAudioRecorder);
    fixture.componentRef.setInput('startLabel', 'Grabar audio');
    fixture.componentRef.setInput('stopLabel', 'Detener grabación');
    fixture.detectChanges();

    button().setPointerCapture = vi.fn();
    button().hasPointerCapture = vi.fn(() => true);
    button().releasePointerCapture = vi.fn();
  });

  const button = (): HTMLButtonElement =>
    fixture.nativeElement.querySelector('[data-testid="caro-audio-button"]') as HTMLButtonElement;

  const pointer = (type: 'pointerdown' | 'pointerup' | 'pointercancel'): void => {
    const event = new Event(type, { bubbles: true, cancelable: true });

    Object.defineProperty(event, 'pointerId', { value: 1 });
    button().dispatchEvent(event);
  };

  const key = (type: 'keydown' | 'keyup', value: string): void => {
    button().dispatchEvent(
      new KeyboardEvent(type, { bubbles: true, cancelable: true, key: value }),
    );
  };

  it('starts on press and stops on release', () => {
    const started = vi.fn();
    fixture.componentInstance.started.subscribe(started);

    pointer('pointerdown');

    expect(started).toHaveBeenCalledOnce();
    expect(service.start).toHaveBeenCalledOnce();
    expect(button().setPointerCapture).toHaveBeenCalledWith(1);

    recording.set(true);
    fixture.detectChanges();
    expect(button().getAttribute('aria-label')).toBe('Detener grabación');
    expect(button().getAttribute('aria-pressed')).toBe('true');

    pointer('pointerup');

    expect(service.stop).toHaveBeenCalledOnce();
    expect(service.cancel).not.toHaveBeenCalled();
    expect(button().releasePointerCapture).toHaveBeenCalledWith(1);
  });

  it('cancels the press when it is released before the microphone starts', () => {
    pointer('pointerdown');
    preparing.set(true);
    fixture.detectChanges();

    expect(button().disabled).toBe(false);

    pointer('pointerup');

    expect(service.cancel).toHaveBeenCalledOnce();
    expect(service.stop).not.toHaveBeenCalled();
  });

  it('does not start a second recording while one is active', () => {
    recording.set(true);
    fixture.detectChanges();

    pointer('pointerdown');
    expect(service.start).not.toHaveBeenCalled();

    pointer('pointerup');
    expect(service.stop).toHaveBeenCalledOnce();
  });

  it('does not start while the page is busy', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    expect(button().disabled).toBe(true);

    pointer('pointerdown');

    expect(service.start).not.toHaveBeenCalled();
  });

  it('supports holding the microphone with the keyboard', () => {
    const started = vi.fn();
    fixture.componentInstance.started.subscribe(started);

    key('keydown', ' ');
    expect(started).toHaveBeenCalledOnce();
    expect(service.start).toHaveBeenCalledOnce();

    recording.set(true);
    key('keyup', ' ');
    expect(service.stop).toHaveBeenCalledOnce();
  });

  it('does not stop anything on a stray release', () => {
    pointer('pointerup');

    expect(service.stop).not.toHaveBeenCalled();
    expect(service.cancel).not.toHaveBeenCalled();
  });
});
