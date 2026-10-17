import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Patient, UcoProcedure } from 'data-access';
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

  beforeEach(async () => {
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
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({}) } },
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
