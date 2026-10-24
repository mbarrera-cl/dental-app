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
  let service: {
    recording: Signal<boolean>;
    preparing: Signal<boolean>;
    elapsedLabel: Signal<string>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    recording = signal(false);
    preparing = signal(false);
    service = {
      recording: recording.asReadonly(),
      preparing: preparing.asReadonly(),
      elapsedLabel: computed(() => '00:05'),
      start: vi.fn(async () => undefined),
      stop: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [CaroAudioRecorder],
      providers: [provideSpartanHlm(), { provide: CaroVoiceRecorderService, useValue: service }],
    }).compileComponents();

    fixture = TestBed.createComponent(CaroAudioRecorder);
    fixture.componentRef.setInput('startLabel', 'Grabar audio');
    fixture.componentRef.setInput('stopLabel', 'Detener grabación');
    fixture.detectChanges();
  });

  const button = (): HTMLButtonElement =>
    fixture.nativeElement.querySelector('[data-testid="caro-audio-button"]') as HTMLButtonElement;

  it('starts recording and emits started after a click', () => {
    const started = vi.fn();
    fixture.componentInstance.started.subscribe(started);

    expect(button().getAttribute('aria-label')).toBe('Grabar audio');
    button().click();

    expect(started).toHaveBeenCalledOnce();
    expect(service.start).toHaveBeenCalledOnce();
    expect(service.stop).not.toHaveBeenCalled();
  });

  it('shows the elapsed time and stops the active recording', () => {
    recording.set(true);
    fixture.detectChanges();

    expect(button().textContent).toContain('00:05');
    expect(button().getAttribute('aria-label')).toBe('Detener grabación');

    button().click();

    expect(service.stop).toHaveBeenCalledOnce();
    expect(service.start).not.toHaveBeenCalled();
  });

  it('is disabled while the page is busy or the mic is preparing', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect(button().disabled).toBe(true);

    fixture.componentRef.setInput('disabled', false);
    preparing.set(true);
    fixture.detectChanges();
    expect(button().disabled).toBe(true);
  });
});
