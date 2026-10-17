import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { SessionStore } from 'auth';
import type { Quote } from 'data-access';
import { provideAppTransloco, provideSpartanHlm } from 'ui';
import { QuotesPage } from './quotes-page';

const BASE = 'http://localhost:3000';
const QUOTES_URL = `${BASE}/quotes`;

const QUOTE: Quote = {
  id: 'quote-1',
  folio: 'COT-2026-0001',
  patientId: 'patient-1',
  patientName: 'Camila Rojas Pérez',
  patientRut: '12345678-5',
  patientEmail: null,
  status: 'borrador',
  validUntil: '2099-01-01T00:00:00.000Z',
  notes: null,
  subtotal: 14000,
  discountTotal: 1000,
  total: 13000,
  approvedTotal: 0,
  version: 1,
  replacesQuoteId: null,
  createdByName: 'Ana',
  createdAt: '2026-10-17T10:00:00.000Z',
  updatedByName: 'Ana',
  updatedAt: '2026-10-17T10:00:00.000Z',
  sanctionedByName: null,
  sanctionedAt: null,
  items: [],
};

const EXPIRED: Quote = {
  ...QUOTE,
  id: 'quote-2',
  folio: 'COT-2026-0002',
  patientName: 'Luis Soto',
  validUntil: '2000-01-01T00:00:00.000Z',
};

interface PageHandle {
  query: { (): string; set(value: string): void };
  statusFilter: { (): string; set(value: string): void };
  filtered: () => Quote[];
  statusOf: (quote: Quote) => string;
}

describe('QuotesPage', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuotesPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAppTransloco(),
        provideSpartanHlm(),
        { provide: SessionStore, useValue: { has: () => true, hasAll: () => true, hasAny: () => true } },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  function render(quotes: Quote[] = [QUOTE, EXPIRED]): ComponentFixture<QuotesPage> {
    const fixture = TestBed.createComponent(QuotesPage);
    fixture.detectChanges();
    http.expectOne((req) => req.url === QUOTES_URL).flush(quotes);
    fixture.detectChanges();

    return fixture;
  }

  function handle(fixture: ComponentFixture<QuotesPage>): PageHandle {
    return fixture.componentInstance as unknown as PageHandle;
  }

  function native(fixture: ComponentFixture<QuotesPage>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the quotations with their totals', () => {
    const fixture = render();

    const rows = native(fixture).querySelectorAll('[data-testid="quotes-row"]');
    expect(rows.length).toBe(2);
    expect(native(fixture).textContent).toContain('COT-2026-0001');
    expect(native(fixture).textContent).toContain('Camila Rojas Pérez');
  });

  it('filters by folio or patient name', () => {
    const fixture = render();
    const page = handle(fixture);

    page.query.set('luis');
    fixture.detectChanges();

    expect(page.filtered().map((quote) => quote.folio)).toEqual(['COT-2026-0002']);
  });

  it('filters by status', () => {
    const fixture = render();
    const page = handle(fixture);

    page.statusFilter.set('borrador');
    fixture.detectChanges();

    expect(page.filtered()).toHaveLength(2);

    page.statusFilter.set('aprobada');
    fixture.detectChanges();

    expect(page.filtered()).toHaveLength(0);
  });

  it('derives the expired state from validUntil', () => {
    const fixture = render();
    const page = handle(fixture);

    expect(page.statusOf(QUOTE)).toBe('borrador');
    expect(page.statusOf(EXPIRED)).toBe('vencida');
  });

  it('shows the empty state when there are no quotations', () => {
    const fixture = render([]);

    expect(native(fixture).querySelectorAll('[data-testid="quotes-row"]').length).toBe(0);
    expect(native(fixture).textContent).toContain('Todavía no hay cotizaciones');
  });
});
