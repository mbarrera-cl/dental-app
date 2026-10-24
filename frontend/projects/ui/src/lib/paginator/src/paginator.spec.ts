import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideAppTransloco } from '../../i18n';
import { provideSpartanHlm } from '../../utils/src';
import { PaginatorComponent } from './paginator';

describe('PaginatorComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaginatorComponent],
      providers: [provideAppTransloco(), provideSpartanHlm()],
    }).compileComponents();
  });

  const render = async (total: number, page: number, pageSize: number) => {
    const fixture = TestBed.createComponent(PaginatorComponent);
    fixture.componentRef.setInput('total', total);
    fixture.componentRef.setInput('page', page);
    fixture.componentRef.setInput('pageSize', pageSize);
    await fixture.whenStable();
    fixture.detectChanges();

    return fixture;
  };

  it('shows the visible range and the page counter', async () => {
    const fixture = await render(25, 2, 10);
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('11–20 de 25');
    expect(compiled.textContent).toContain('Página 2 de 3');
  });

  it('clamps displayed pages out of range', async () => {
    const fixture = await render(12, 9, 10);
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Página 2 de 2');
    expect(compiled.textContent).toContain('11–12 de 12');
  });

  it('emits the next page and disables the edges', async () => {
    const fixture = await render(25, 1, 10);
    const compiled = fixture.nativeElement as HTMLElement;
    const previous = compiled.querySelector<HTMLButtonElement>(
      'button[aria-label="Página anterior"]',
    );
    const next = compiled.querySelector<HTMLButtonElement>(
      'button[aria-label="Página siguiente"]',
    );

    expect(previous?.disabled).toBe(true);
    expect(next?.disabled).toBe(false);

    let requested: number | undefined;
    fixture.componentInstance.pageChange.subscribe((page) => (requested = page));

    next!.click();

    expect(requested).toBe(2);
  });

  it('offers the configured size and emits size changes', async () => {
    const fixture = await render(25, 1, 30);
    const compiled = fixture.nativeElement as HTMLElement;
    const select = compiled.querySelector<HTMLSelectElement>('select')!;

    expect([...select.options].map((option) => option.value)).toContain('30');
    expect(select.value).toBe('30');

    let requested: number | undefined;
    fixture.componentInstance.pageSizeChange.subscribe((size) => (requested = size));

    select.value = '50';
    select.dispatchEvent(new Event('change'));

    expect(requested).toBe(50);
  });
});
