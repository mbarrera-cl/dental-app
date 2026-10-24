import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { PkThinking } from './pk-thinking';

describe('PkThinking', () => {
  it('renders its label as a polite live status', () => {
    const fixture = TestBed.createComponent(PkThinking);
    fixture.componentRef.setInput('label', 'CaroIA está pensando…');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.getAttribute('role')).toBe('status');
    expect(element.getAttribute('aria-live')).toBe('polite');
    expect(element.getAttribute('aria-atomic')).toBe('true');
    expect(element.textContent).toContain('CaroIA está pensando…');
  });
});
