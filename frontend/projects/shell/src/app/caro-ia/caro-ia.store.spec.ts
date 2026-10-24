import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CaroIaGateway, type CaroTranscription } from 'data-access';
import { CaroIaMockGateway } from './caro-ia.mock';
import { CaroIaStore } from './caro-ia.store';

describe('CaroIaStore', () => {
  let store: CaroIaStore;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [{ provide: CaroIaGateway, useClass: CaroIaMockGateway }],
    });
    store = TestBed.inject(CaroIaStore);
  });

  afterEach(() => {
    store.stop();
    vi.useRealTimers();
  });

  function load(): void {
    store.loadConversations();
    vi.advanceTimersByTime(200);
    vi.advanceTimersByTime(200);
  }

  function openFirst(): void {
    load();
    const first = store.conversations()[0];
    expect(first).toBeDefined();
    store.open(first!.id);
    vi.advanceTimersByTime(200);
  }

  it('loads the seeded conversations without opening one', () => {
    load();

    expect(store.conversations()).toHaveLength(5);
    expect(store.activeId()).toBeNull();
    expect(store.messages()).toHaveLength(0);
  });

  it('opens a conversation when the user selects it', () => {
    openFirst();

    expect(store.activeId()).not.toBeNull();
    expect(store.messages().length).toBeGreaterThan(0);
    expect(store.activeConversation()?.title).toContain('COT-2026-0001');
  });

  it('keeps a draft until the first send creates the conversation', () => {
    load();
    const before = store.conversations().length;

    store.startDraft();
    expect(store.activeId()).toBeNull();
    expect(store.messages()).toHaveLength(0);

    store.send('Resume el presupuesto COT-2026-0001');
    vi.runAllTimers();

    expect(store.conversations()).toHaveLength(before + 1);
    expect(store.activeConversation()?.title).toBe('Resume el presupuesto COT-2026-0001');
    expect(store.messages().length).toBe(2);
  });

  it('streams an answer with a tool call and closes the turn', () => {
    openFirst();
    const before = store.messages().length;

    store.send('Resume el presupuesto COT-2026-0001');
    vi.runAllTimers();

    const messages = store.messages();

    expect(messages.length).toBe(before + 2);
    expect(messages.at(-2)?.role).toBe('user');
    expect(messages.at(-1)?.role).toBe('assistant');
    expect(messages.at(-1)?.content).toContain('$6.000');
    expect(messages.at(-1)?.toolCalls[0]?.state).toBe('success');
    expect(store.sending()).toBe(false);
  });

  it('derives the stream phase from real events', () => {
    openFirst();

    store.send('Resume el presupuesto COT-2026-0001');
    expect(store.streamPhase()).toBe('thinking');

    // The mock starts a tool at 200 ms, before it streams any text.
    vi.advanceTimersByTime(250);
    expect(store.streamPhase()).toBe('tool');

    // Text starts at 760 ms.
    vi.advanceTimersByTime(600);
    expect(store.streamPhase()).toBe('writing');

    vi.runAllTimers();
    expect(store.streamPhase()).toBe('idle');
  });

  it('returns to idle when the user stops the stream', () => {
    openFirst();

    store.send('Resume el presupuesto COT-2026-0001');
    expect(store.streamPhase()).toBe('thinking');

    store.stop();
    expect(store.streamPhase()).toBe('idle');
    expect(store.sending()).toBe(false);
  });

  it('pauses on a write and resolves the approval when approved', () => {
    openFirst();
    const approval = store
      .messages()
      .flatMap((message) => message.approvals)
      .find((item) => item.status === 'pending');

    expect(approval).toBeDefined();

    store.decideApproval(approval!.id, 'approve');
    vi.runAllTimers();

    const resolved = store
      .messages()
      .flatMap((message) => message.approvals)
      .find((item) => item.id === approval!.id);

    expect(resolved?.status).toBe('approved');
    expect(store.messages().at(-1)?.content).toContain('COT-2026-0007');
    expect(store.approving()).toBe(false);
  });

  it('returns a transcription for audio', () => {
    const received: CaroTranscription[] = [];

    store.transcribe(new Blob(['fake'], { type: 'audio/webm' })).subscribe((result) => {
      received.push(result);
    });
    vi.advanceTimersByTime(1300);

    expect(received[0]?.text).toContain('Resume el presupuesto');
    expect(store.transcribing()).toBe(false);
  });

  it('creates, renames and removes conversations', () => {
    load();
    const initial = store.conversations().length;

    store.create('Prueba');
    vi.advanceTimersByTime(200);
    expect(store.conversations()).toHaveLength(initial + 1);
    const created = store.activeConversation();
    expect(created?.title).toBe('Prueba');

    store.rename(created!.id, 'Prueba renombrada');
    vi.advanceTimersByTime(200);
    expect(store.activeConversation()?.title).toBe('Prueba renombrada');

    store.remove(created!.id);
    vi.advanceTimersByTime(200);
    expect(store.conversations().some((row) => row.id === created!.id)).toBe(false);
  });
});
