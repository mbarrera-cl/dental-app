import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
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
  deletedAt: null,
  deletedByName: null,
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
  view: { (): 'active' | 'trash' };
  filtered: () => Quote[];
  statusOf: (quote: Quote) => string;
  isExpired: (quote: Quote) => boolean;
  askRestore(quote: Quote): void;
}

const TRASHED: Quote = {
  ...QUOTE,
  id: 'quote-2',
  folio: 'COT-2026-0002',
  status: 'aprobada',
  deletedAt: '2026-10-17T11:00:00.000Z',
  deletedByName: 'Ana',
};

describe('QuotesPage', () => {
  let http: HttpTestingController;
  let queryParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(async () => {
    queryParams = new BehaviorSubject(convertToParamMap({}));

    await TestBed.configureTestingModule({
      imports: [QuotesPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAppTransloco(),
        provideSpartanHlm(),
        { provide: SessionStore, useValue: { has: () => true, hasAll: () => true, hasAny: () => true } },
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: queryParams.asObservable() },
        },
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
    expect(native(fixture).querySelector('[data-testid="quotes-edit-quote-1"]')).not.toBeNull();
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

  it('keeps the workflow status and shows expiry as a separate warning', () => {
    const fixture = render();
    const page = handle(fixture);

    expect(page.statusOf(QUOTE)).toBe('borrador');
    expect(page.statusOf(EXPIRED)).toBe('borrador');
    expect(page.isExpired(QUOTE)).toBe(false);
    expect(page.isExpired(EXPIRED)).toBe(true);
    expect(native(fixture).querySelector('[data-testid="quotes-expired"]')?.textContent).toContain(
      'Vencida',
    );
  });

  it('filters by patient when the URL carries ?patientId', () => {
    const fixture = TestBed.createComponent(QuotesPage);
    fixture.detectChanges();

    // The initial (empty) query triggers the unfiltered load.
    http.expectOne((request) => request.url === QUOTES_URL).flush([QUOTE]);
    fixture.detectChanges();

    queryParams.next(convertToParamMap({ patientId: 'patient-1' }));
    fixture.detectChanges();

    const filtered = http.expectOne(
      (request) => request.url === QUOTES_URL && request.params.get('patientId') === 'patient-1',
    );
    expect(filtered.request.params.get('patientId')).toBe('patient-1');
    filtered.flush([QUOTE]);
    http.expectOne(`${BASE}/patients/patient-1`).flush({
      id: 'patient-1',
      rut: '12345678-5',
      nombres: 'Camila',
      apellidoPaterno: 'Rojas',
      apellidoMaterno: 'Pérez',
      fechaNacimiento: '1990-05-17',
      sexo: 'femenino',
      email: null,
      telefono: null,
      direccion: null,
      prevision: null,
      contactoEmergencia: null,
      notas: null,
      numeroHistoria: 'HC-000001',
      createdAt: '2026-10-01T08:00:00.000Z',
    });
    fixture.detectChanges();

    const nativeElement = fixture.nativeElement as HTMLElement;
    expect(nativeElement.querySelector('[data-testid="quotes-patient-banner"]')).not.toBeNull();
    expect(nativeElement.textContent).toContain('Camila Rojas Pérez');
  });

  it('lists the trash when the URL says so', () => {
    const fixture = render();
    const page = handle(fixture);

    queryParams.next(convertToParamMap({ deleted: 'only' }));
    fixture.detectChanges();

    const trashRequest = http.expectOne(
      (request) => request.url === QUOTES_URL && request.params.get('deleted') === 'only',
    );
    trashRequest.flush([TRASHED]);
    fixture.detectChanges();

    expect(page.view()).toBe('trash');
    expect(native(fixture).querySelector('[data-testid="quotes-trash-banner"]')).not.toBeNull();
    expect(native(fixture).querySelectorAll('[data-testid="quotes-row"]').length).toBe(1);
    expect(native(fixture).querySelector('[data-testid="quotes-restore-quote-2"]')).not.toBeNull();
    // No print/edit/delete actions in the trash.
    expect(native(fixture).querySelector('[data-testid="quotes-print-quote-2"]')).toBeNull();
    expect(native(fixture).querySelector('[data-testid="quotes-edit-quote-2"]')).toBeNull();
    expect(native(fixture).querySelector('[data-testid="quotes-delete-quote-2"]')).toBeNull();
  });

  it('restores a trashed quote', () => {
    const fixture = render();
    const page = handle(fixture);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

    queryParams.next(convertToParamMap({ deleted: 'only' }));
    fixture.detectChanges();
    http
      .expectOne((request) => request.url === QUOTES_URL && request.params.get('deleted') === 'only')
      .flush([TRASHED]);
    fixture.detectChanges();

    page.askRestore(TRASHED);

    const request = http.expectOne(`${QUOTES_URL}/quote-2/restore`);
    expect(request.request.method).toBe('POST');
    request.flush({ ...TRASHED, deletedAt: null, deletedByName: null });

    // The page reloads the current (trash) view.
    http
      .expectOne((request) => request.url === QUOTES_URL && request.params.get('deleted') === 'only')
      .flush([]);

    confirm.mockRestore();
  });

  it('shows the empty state when there are no quotations', () => {
    const fixture = render([]);

    expect(native(fixture).querySelectorAll('[data-testid="quotes-row"]').length).toBe(0);
    expect(native(fixture).textContent).toContain('Todavía no hay cotizaciones');
  });
});
