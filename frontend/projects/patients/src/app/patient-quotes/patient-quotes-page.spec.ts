import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { SessionStore } from 'auth';
import type { Quote } from 'data-access';
import { provideAppTransloco, provideSpartanHlm } from 'ui';
import { PatientQuotesPage } from './patient-quotes-page';

const BASE = 'http://localhost:3000';
const PATIENT_ID = 'patient-1';

const QUOTE: Quote = {
  id: 'quote-1',
  folio: 'COT-2026-0001',
  patientId: PATIENT_ID,
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

describe('PatientQuotesPage', () => {
  let http: HttpTestingController;
  let paramMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(async () => {
    paramMap = new BehaviorSubject(convertToParamMap({ id: PATIENT_ID }));

    await TestBed.configureTestingModule({
      imports: [PatientQuotesPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAppTransloco(),
        provideSpartanHlm(),
        { provide: SessionStore, useValue: { has: () => true, hasAll: () => true, hasAny: () => true } },
        {
          provide: ActivatedRoute,
          useValue: { parent: { paramMap: paramMap.asObservable() } },
        },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  function render(quotes: Quote[] = [QUOTE]): ComponentFixture<PatientQuotesPage> {
    const fixture = TestBed.createComponent(PatientQuotesPage);
    fixture.detectChanges();
    http
      .expectOne((request) => request.url === `${BASE}/quotes` && request.params.get('patientId') === PATIENT_ID)
      .flush(quotes);
    fixture.detectChanges();

    return fixture;
  }

  function native(fixture: ComponentFixture<PatientQuotesPage>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('loads only the quotations of the patient', () => {
    const fixture = render();

    const rows = native(fixture).querySelectorAll('[data-testid="patient-quote-row"]');
    expect(rows.length).toBe(1);
    expect(native(fixture).textContent).toContain('COT-2026-0001');
  });

  it('links the new budget to the patient context', () => {
    const fixture = render();
    const link = native(fixture).querySelector<HTMLAnchorElement>('[data-testid="patient-quotes-new"]');

    expect(link).not.toBeNull();
    expect(link!.getAttribute('href')).toContain('/quotes/new');
    expect(link!.getAttribute('href')).toContain(`patientId=${PATIENT_ID}`);
  });

  it('shows the empty state when the patient has no quotations', () => {
    const fixture = render([]);

    expect(native(fixture).querySelectorAll('[data-testid="patient-quote-row"]').length).toBe(0);
    expect(native(fixture).textContent).toContain('Este paciente todavía no tiene presupuestos');
  });

  it('reloads when the patient route param changes', () => {
    const fixture = render();
    const page = fixture.componentInstance as unknown as { patientId: () => string };

    paramMap.next(convertToParamMap({ id: 'patient-2' }));
    fixture.detectChanges();

    http
      .expectOne((request) => request.url === `${BASE}/quotes` && request.params.get('patientId') === 'patient-2')
      .flush([]);

    expect(page.patientId()).toBe('patient-2');
  });
});
