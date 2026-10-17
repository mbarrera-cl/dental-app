import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideAppTransloco } from 'ui';
import { defaultStateFor, type ClinicalFinding, type FindingSymbol } from 'data-access';
import { OdontogramChart } from './odontogram-chart';

function buildFinding(
  tooth: number,
  symbol: FindingSymbol,
  overrides: Partial<ClinicalFinding> = {},
): ClinicalFinding {
  return {
    id: `finding-${tooth}-${symbol}-${overrides.id ?? 'x'}`,
    recordId: 'record-1',
    tooth,
    surfaces: [],
    symbol,
    state: defaultStateFor(symbol),
    recesion: null,
    movilidad: null,
    note: null,
    createdBy: 'user-1',
    createdAt: '2026-10-16T10:00:00.000Z',
    voidedAt: null,
    voidedBy: null,
    isVoided: false,
    ...overrides,
  };
}

describe('OdontogramChart', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OdontogramChart],
      providers: [provideAppTransloco()],
    }).compileComponents();
  });

  function render(findings: ClinicalFinding[], selectedTooth: number | null = null) {
    const fixture = TestBed.createComponent(OdontogramChart);
    fixture.componentRef.setInput('findings', findings);
    fixture.componentRef.setInput('dentition', 'permanente');
    fixture.componentRef.setInput('selectedTooth', selectedTooth);
    fixture.detectChanges();

    return fixture;
  }

  it('paints red the pending surfaces and blue the performed ones', () => {
    const fixture = render([
      buildFinding(11, 'caries', { id: 'a', surfaces: ['M', 'D'] }),
      buildFinding(11, 'obturado', { id: 'b', surfaces: ['O'] }),
    ]);

    const compiled = fixture.nativeElement as HTMLElement;

    expect(
      compiled.querySelector('[data-testid="odontogram-surface-11-M"]')?.getAttribute('fill'),
    ).toBe('#fca5a5');
    expect(
      compiled.querySelector('[data-testid="odontogram-surface-11-D"]')?.getAttribute('fill'),
    ).toBe('#fca5a5');
    expect(
      compiled.querySelector('[data-testid="odontogram-surface-11-O"]')?.getAttribute('fill'),
    ).toBe('#93c5fd');
    expect(
      compiled.querySelector('[data-testid="odontogram-surface-11-V"]')?.getAttribute('fill'),
    ).toBe('transparent');
  });

  it('draws whole-tooth symbols as glyph badges and ignores voided findings', () => {
    const fixture = render([
      buildFinding(36, 'corona'),
      buildFinding(36, 'caries', { id: 'voided', surfaces: ['O'], isVoided: true }),
    ]);

    const compiled = fixture.nativeElement as HTMLElement;
    const crown = compiled.querySelector('[data-testid="odontogram-tooth-36"]');

    expect(crown?.parentElement?.textContent).toContain('C');
    expect(
      compiled.querySelector('[data-testid="odontogram-surface-36-O"]')?.getAttribute('fill'),
    ).toBe('transparent');
  });

  it('emits the tooth on a click and the surface on a region click', () => {
    const fixture = render([]);
    const toothSelected = vi.fn();
    const surfaceSelected = vi.fn();

    fixture.componentInstance.toothSelected.subscribe(toothSelected);
    fixture.componentInstance.surfaceSelected.subscribe(surfaceSelected);

    const compiled = fixture.nativeElement as HTMLElement;
    const crown = compiled.querySelector('[data-testid="odontogram-tooth-21"]');
    const mesial = compiled.querySelector('[data-testid="odontogram-surface-21-M"]');

    mesial?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    crown?.dispatchEvent(new MouseEvent('click'));

    expect(surfaceSelected).toHaveBeenCalledTimes(1);
    expect(surfaceSelected).toHaveBeenCalledWith({ tooth: 21, surface: 'M' });
    // The surface click stops propagation: the tooth handler only sees the
    // click on the tooth body itself.
    expect(toothSelected).toHaveBeenCalledTimes(1);
    expect(toothSelected).toHaveBeenCalledWith(21);
  });

  it('renders the primary dentition on demand', () => {
    const fixture = TestBed.createComponent(OdontogramChart);
    fixture.componentRef.setInput('findings', []);
    fixture.componentRef.setInput('dentition', 'temporal');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('[data-testid="odontogram-tooth-55"]')).not.toBeNull();
    expect(compiled.querySelector('[data-testid="odontogram-tooth-18"]')).toBeNull();
  });
});
