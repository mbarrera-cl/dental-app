import { provideHttpClient, type HttpResponse } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Patient } from './patient.model';
import { PatientsApi } from './patients-api';
import { API_BASE_URL } from './api-base-url';

const BASE_URL = 'http://api.test/v1/';

const CAMILA: Patient = {
  id: 'patient-1',
  rut: '12345678-5',
  nombres: 'Camila',
  apellidoPaterno: 'Rojas',
  apellidoMaterno: 'Pérez',
  fechaNacimiento: '1990-05-17',
  sexo: 'femenino',
  email: 'camila@example.com',
  telefono: '+56912345678',
  direccion: {
    region: 'RM',
    comuna: 'Providencia',
    calle: 'Av. Providencia',
    numero: '1234',
    departamento: null,
  },
  prevision: { tipo: 'FONASA', tramo: 'B', plan: null, convenio: null },
  contactoEmergencia: null,
  notas: null,
  numeroHistoria: 'HC-000001',
  createdAt: '2026-10-16T10:00:00.000Z',
};

describe('PatientsApi', () => {
  let api: PatientsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE_URL },
      ],
    });

    api = TestBed.inject(PatientsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('lists patients trimming trailing slashes from the base URL', () => {
    let received: Patient[] | undefined;
    api.list().subscribe((patients) => (received = patients));

    const request = http.expectOne('http://api.test/v1/patients');
    expect(request.request.method).toBe('GET');
    request.flush([CAMILA]);

    expect(received).toEqual([CAMILA]);
  });

  it('downloads the patients workbook with the current search', () => {
    let received: HttpResponse<Blob> | undefined;

    api.exportExcel('  camila  ').subscribe((response) => (received = response));

    const request = http.expectOne(
      (candidate) =>
        candidate.url === 'http://api.test/v1/patients/export.xlsx' &&
        candidate.params.get('q') === 'camila',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.responseType).toBe('blob');

    const blob = new Blob(['PK']);
    request.flush(blob, {
      headers: {
        'Content-Disposition': 'attachment; filename="pacientes-2026-10-24.xlsx"',
      },
    });

    expect(received?.body).toBe(blob);
    expect(received?.headers.get('Content-Disposition')).toContain('pacientes-2026-10-24.xlsx');
  });

  it('omits the q parameter when no search is active', () => {
    api.exportExcel().subscribe();

    const request = http.expectOne('http://api.test/v1/patients/export.xlsx');
    expect(request.request.params.keys()).toHaveLength(0);
  });

  it('gets a single patient by id', () => {
    api.getById('patient-1').subscribe();
    http.expectOne('http://api.test/v1/patients/patient-1').flush(CAMILA);
  });

  it('gets a single patient by RUT, encoding the value', () => {
    api.getByRut('12.345.678-5').subscribe();
    http.expectOne('http://api.test/v1/patients/rut/12.345.678-5').flush(CAMILA);
  });

  it('creates a patient with the payload as body', () => {
    let received: Patient | undefined;
    api
      .create({
        rut: '12345678-5',
        nombres: 'Camila',
        apellidoPaterno: 'Rojas',
        apellidoMaterno: 'Pérez',
        fechaNacimiento: '1990-05-17',
        sexo: 'femenino',
      })
      .subscribe((patient) => (received = patient));

    const request = http.expectOne('http://api.test/v1/patients');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toMatchObject({ rut: '12345678-5', sexo: 'femenino' });
    request.flush(CAMILA);

    expect(received).toEqual(CAMILA);
  });

  it('updates a patient with PATCH and an encoded id', () => {
    api.update('id with spaces', { telefono: '+56911112222' }).subscribe();

    const request = http.expectOne('http://api.test/v1/patients/id%20with%20spaces');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ telefono: '+56911112222' });
    request.flush(CAMILA);
  });

  it('deletes a patient', () => {
    api.delete('patient-1').subscribe();

    const request = http.expectOne('http://api.test/v1/patients/patient-1');
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 200, statusText: 'OK' });
  });
});
