import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Patient, Quote, UcoProcedure } from 'data-access';
import { SessionStore } from 'auth';
import { provideAppTransloco, provideSpartanHlm } from 'ui';
import { QuoteEditor } from './quote-editor';

const BASE = 'http://localhost:3000';

const PATIENT: Patient = {
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
  createdAt: '2026-10-16T10:00:00.000Z',
};

const QUOTE: Quote = {
  id: 'quote-1',
  folio: 'COT-2026-0001',
  patientId: PATIENT.id,
  patientName: 'Camila Rojas Pérez',
  patientRut: '12345678-5',
  patientEmail: null,
  status: 'aprobada',
  validUntil: '2099-01-01T00:00:00.000Z',
  notes: null,
  subtotal: 14000,
  discountTotal: 1000,
  total: 13000,
  approvedTotal: 0,
  version: 2,
  replacesQuoteId: null,
  createdByName: 'Ana',
  createdAt: '2026-10-17T10:00:00.000Z',
  updatedByName: 'Ana',
  updatedAt: '2026-10-17T10:00:00.000Z',
  sanctionedByName: 'Ana',
  sanctionedAt: '2026-10-17T10:00:00.000Z',
  deletedAt: null,
  deletedByName: null,
  items: [
    {
      id: 'item-1',
      ucoCode: '020001',
      description: 'Obturación de una superficie',
      piezaDental: null,
      quantity: 1,
      unitPrice: 14000,
      discountPercent: 0,
      subtotal: 14000,
      discountAmount: 0,
      netAmount: 14000,
      status: 'aprobado',
      statusChangedByName: 'Ana',
      statusChangedAt: '2026-10-17T10:00:00.000Z',
    },
  ],
};

const PROCEDURE: UcoProcedure = {
  id: 'uco-1',
  code: '020001',
  chapter: '2',
  name: 'Obturación de una superficie',
  units: 2,
  status: 'active',
  createdAt: '2026-10-17T10:00:00.000Z',
  updatedAt: '2026-10-17T10:00:00.000Z',
};

interface PageHandle {
  selectPatient: (patient: Patient) => void;
  addProcedure: (procedure: UcoProcedure) => void;
  items: () => Array<{ description: string; quantity: number; unitPrice: number; discountPercent: number }>;
  subtotal: () => number;
  discountTotal: () => number;
  total: () => number;
  create: () => void;
}

describe('QuoteEditor', () => {
  let http: HttpTestingController;
  let queryParams: Record<string, string>;
  let routeId = '';

  beforeEach(async () => {
    queryParams = {};
    routeId = '';

    await TestBed.configureTestingModule({
      imports: [QuoteEditor],
      providers: [
        provideRouter([
          { path: 'quotes/:id', children: [] },
          { path: '**', children: [] },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAppTransloco(),
        provideSpartanHlm(),
        {
          provide: SessionStore,
          useValue: { has: () => true, hasAll: () => true, hasAny: () => true },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              get paramMap() {
                return convertToParamMap(routeId === '' ? {} : { id: routeId });
              },
              get queryParamMap() {
                return convertToParamMap(queryParams);
              },
            },
          },
        },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  function render(): ComponentFixture<QuoteEditor> {
    const fixture = TestBed.createComponent(QuoteEditor);
    fixture.detectChanges();
    http.expectOne(`${BASE}/patients`).flush([PATIENT]);
    http.expectOne((req) => req.url === `${BASE}/uco`).flush([PROCEDURE]);
    fixture.detectChanges();

    return fixture;
  }

  function handle(fixture: ComponentFixture<QuoteEditor>): PageHandle {
    return fixture.componentInstance as unknown as PageHandle;
  }

  it('computes the totals live as items are added', () => {
    const fixture = render();
    const page = handle(fixture);

    page.addProcedure(PROCEDURE);
    page.items()[0]!.discountPercent = 0;
    fixture.detectChanges();

    expect(page.items()).toHaveLength(1);
    expect(page.subtotal()).toBe(Number.parseInt(String(PROCEDURE.units * 3000), 10));
    expect(page.discountTotal()).toBe(0);
    expect(page.total()).toBe(page.subtotal());
  });

  it('locks the patient when the URL carries ?patientId', () => {
    queryParams = { patientId: PATIENT.id };

    const fixture = TestBed.createComponent(QuoteEditor);
    fixture.detectChanges();
    http.expectOne(`${BASE}/patients`).flush([PATIENT]);
    http.expectOne((req) => req.url === `${BASE}/uco`).flush([PROCEDURE]);
    http.expectOne(`${BASE}/patients/${PATIENT.id}`).flush(PATIENT);
    fixture.detectChanges();

    const native = fixture.nativeElement as HTMLElement;
    expect(native.querySelector('[data-testid="quote-patient-search"]')).toBeNull();
    expect(native.querySelector('[data-testid="quote-patient-locked"]')?.textContent).toContain('Camila');
  });

  it('keeps an approved quote editable and exposes the four-state selector', () => {
    routeId = QUOTE.id;
    const fixture = TestBed.createComponent(QuoteEditor);
    fixture.detectChanges();
    http.expectOne(`${BASE}/patients`).flush([PATIENT]);
    http.expectOne((req) => req.url === `${BASE}/uco`).flush([PROCEDURE]);
    http.expectOne(`${BASE}/quotes/${QUOTE.id}`).flush(QUOTE);
    fixture.detectChanges();

    const native = fixture.nativeElement as HTMLElement;
    const select = native.querySelector<HTMLSelectElement>('[data-testid="quote-status-select"]');
    expect(select).not.toBeNull();
    expect([...select!.options].map((option) => option.value)).toEqual([
      'borrador',
      'sin_respuesta',
      'aprobada',
      'rechazada',
    ]);
    expect(native.querySelector('[data-testid="quote-save"]')).not.toBeNull();
    expect(
      native.querySelector<HTMLInputElement>('[data-testid="quote-item-desc"]')?.disabled,
    ).toBe(false);
  });

  it('creates a quote for the selected patient', () => {
    const fixture = render();
    const page = handle(fixture);

    page.selectPatient(PATIENT);
    page.addProcedure(PROCEDURE);
    page.create();

    const request = http.expectOne(`${BASE}/quotes`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toMatchObject({
      patientId: 'patient-1',
      items: [{ ucoCode: '020001', description: 'Obturación de una superficie', quantity: 1 }],
    });
    request.flush({ id: 'quote-1' });
  });
});
