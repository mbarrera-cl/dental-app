import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  API_BASE_URL,
  ANTECEDENTES,
  PIEZAS_HIGIENE_ORAL,
  REGIONES_ESTOMATOGNATICAS,
  type AntecedentesRecord,
  type ClinicalFinding,
  type ClinicalIndices,
  type ClinicalRecord,
  type HigieneOralRecord,
  type Patient,
  type RegionesRecord,
} from 'data-access';
import { ClinicalRecordStore } from './clinical-record.store';

const BASE_URL = 'http://api.test/v1/';
const PATIENT_ID = 'patient-1';
const RECORD_ID = 'record-1';

const PATIENT: Patient = {
  id: PATIENT_ID,
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
};

function buildRecord(): ClinicalRecord {
  const antecedentes = {} as AntecedentesRecord;

  for (const key of ANTECEDENTES) {
    antecedentes[key] = { present: false, notes: null };
  }

  const regiones = {} as RegionesRecord;

  for (const region of REGIONES_ESTOMATOGNATICAS) {
    regiones[region] = null;
  }

  const higieneOral = {} as HigieneOralRecord;

  for (const tooth of PIEZAS_HIGIENE_ORAL) {
    higieneOral[tooth] = { placa: null, calculo: null, gingivitis: null };
  }

  return {
    id: RECORD_ID,
    patientId: PATIENT_ID,
    categoria: 'mayor-20',
    embarazada: false,
    status: 'borrador',
    motivoConsulta: null,
    enfermedadActual: null,
    antecedentes,
    signosVitales: {
      presionArterialSistolica: null,
      presionArterialDiastolica: null,
      frecuenciaCardiaca: null,
      temperatura: null,
      frecuenciaRespiratoria: null,
    },
    examenEstomatognatico: { regiones, descripcion: null },
    indicadores: { higieneOral, enfermedadPeriodontal: null, maloclusion: null, fluorosis: null },
    createdBy: 'user-1',
    updatedBy: null,
    createdAt: '2026-10-16T10:00:00.000Z',
    updatedAt: '2026-10-16T10:00:00.000Z',
    finalizedAt: null,
    finalizedBy: null,
  };
}

const FINDING: ClinicalFinding = {
  id: 'finding-1',
  recordId: RECORD_ID,
  tooth: 36,
  surfaces: ['O'],
  symbol: 'caries',
  state: 'a-realizar',
  recesion: null,
  movilidad: null,
  note: null,
  createdBy: 'user-1',
  createdAt: '2026-10-16T10:00:00.000Z',
  voidedAt: null,
  voidedBy: null,
  isVoided: false,
};

const INDICES: ClinicalIndices = {
  permanentes: { cariados: [36], perdidos: [], obturados: [], total: 1 },
  temporales: { cariados: [], perdidos: [], obturados: [], total: 0 },
  higieneOral: { placa: 0, calculo: 0, gingivitis: 0, total: 0 },
};

describe('ClinicalRecordStore', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ClinicalRecordStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE_URL },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: PATIENT_ID })) },
        },
      ],
    });

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  function loadPatient(): void {
    http.expectOne('http://api.test/v1/patients/patient-1').flush(PATIENT);
  }

  function loadRecord(): void {
    http
      .expectOne('http://api.test/v1/patients/patient-1/clinical-record')
      .flush(buildRecord());
    http.expectOne(`http://api.test/v1/clinical-records/${RECORD_ID}/findings`).flush([FINDING]);
    http.expectOne(`http://api.test/v1/clinical-records/${RECORD_ID}/indices`).flush(INDICES);
  }

  it('treats a missing clinical record as a normal state (404 on load)', () => {
    const store = TestBed.inject(ClinicalRecordStore);

    loadPatient();
    http
      .expectOne('http://api.test/v1/patients/patient-1/clinical-record')
      .flush(
        { statusCode: 404, error: 'PatientClinicalRecordNotFoundError', message: 'no record' },
        { status: 404, statusText: 'Not Found' },
      );

    expect(store.patient()?.numeroHistoria).toBe('HC-000001');
    expect(store.record()).toBeNull();
    expect(store.loading()).toBe(false);
    expect(store.loadError()).toBeNull();
  });

  it('loads the record with its findings and derived indices', () => {
    const store = TestBed.inject(ClinicalRecordStore);

    loadPatient();
    loadRecord();

    expect(store.record()?.id).toBe(RECORD_ID);
    expect(store.findings()).toEqual([FINDING]);
    expect(store.indices()?.permanentes.total).toBe(1);
    expect(store.loading()).toBe(false);
  });

  it('opens the record of the patient and refreshes the derived data', () => {
    const store = TestBed.inject(ClinicalRecordStore);

    loadPatient();
    http
      .expectOne('http://api.test/v1/patients/patient-1/clinical-record')
      .flush({ statusCode: 404, error: 'PatientClinicalRecordNotFoundError', message: 'x' }, { status: 404, statusText: 'Not Found' });

    store.createRecord({ categoria: '5-9-programado' }).subscribe();
    const request = http.expectOne('http://api.test/v1/patients/patient-1/clinical-record');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ categoria: '5-9-programado' });
    request.flush(buildRecord());

    http.expectOne(`http://api.test/v1/clinical-records/${RECORD_ID}/findings`).flush([]);
    http.expectOne(`http://api.test/v1/clinical-records/${RECORD_ID}/indices`).flush(INDICES);

    expect(store.record()?.id).toBe(RECORD_ID);
    expect(store.creating()).toBe(false);
  });

  it('appends findings and voids them through the append-only log', () => {
    const store = TestBed.inject(ClinicalRecordStore);

    loadPatient();
    loadRecord();

    store.addFinding({ tooth: 36, surfaces: ['O'], symbol: 'caries' }).subscribe();
    const post = http.expectOne(`http://api.test/v1/clinical-records/${RECORD_ID}/findings`);
    expect(post.request.method).toBe('POST');
    post.flush(FINDING);
    http.expectOne(`http://api.test/v1/clinical-records/${RECORD_ID}/findings`).flush([FINDING]);
    http.expectOne(`http://api.test/v1/clinical-records/${RECORD_ID}/indices`).flush(INDICES);

    expect(store.findings()).toEqual([FINDING]);

    store.voidFinding(FINDING.id).subscribe();
    const voided = { ...FINDING, isVoided: true, voidedAt: '2026-10-16T11:00:00.000Z' };
    http
      .expectOne(`http://api.test/v1/clinical-records/${RECORD_ID}/findings/finding-1/void`)
      .flush(voided);
    http.expectOne(`http://api.test/v1/clinical-records/${RECORD_ID}/findings`).flush([voided]);
    http.expectOne(`http://api.test/v1/clinical-records/${RECORD_ID}/indices`).flush(INDICES);

    expect(store.findings()[0].isVoided).toBe(true);
  });

  it('patches the record and refreshes the derived indices', () => {
    const store = TestBed.inject(ClinicalRecordStore);

    loadPatient();
    loadRecord();

    store.updateRecord({ motivoConsulta: 'Dolor en pieza 36' }).subscribe();
    const patch = http.expectOne(`http://api.test/v1/clinical-records/${RECORD_ID}`);
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ motivoConsulta: 'Dolor en pieza 36' });
    patch.flush({ ...buildRecord(), motivoConsulta: 'Dolor en pieza 36' });
    http.expectOne(`http://api.test/v1/clinical-records/${RECORD_ID}/indices`).flush(INDICES);

    expect(store.record()?.motivoConsulta).toBe('Dolor en pieza 36');
  });

  it('does not refetch a patient that is already loaded', () => {
    const store = TestBed.inject(ClinicalRecordStore);

    loadPatient();
    loadRecord();

    // A re-evaluated route asks again for the same patient: no new requests.
    store.load(PATIENT_ID);

    expect(store.record()?.id).toBe(RECORD_ID);
    expect(store.loading()).toBe(false);
    http.expectNone('http://api.test/v1/patients/patient-1');
  });

  it('switches patients, cancelling the requests of the previous one', () => {
    const route$ = new BehaviorSubject(convertToParamMap({ id: PATIENT_ID }));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ClinicalRecordStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE_URL },
        { provide: ActivatedRoute, useValue: { paramMap: route$.asObservable() } },
      ],
    });

    http = TestBed.inject(HttpTestingController);
    const store = TestBed.inject(ClinicalRecordStore);

    // The first patient never answers: its requests are abandoned below.
    http.expectOne('http://api.test/v1/patients/patient-1').flush(PATIENT);
    http
      .expectOne('http://api.test/v1/patients/patient-1/clinical-record')
      .flush(buildRecord());
    http.expectOne(`http://api.test/v1/clinical-records/${RECORD_ID}/findings`).flush([]);
    http.expectOne(`http://api.test/v1/clinical-records/${RECORD_ID}/indices`).flush(INDICES);

    route$.next(convertToParamMap({ id: 'patient-2' }));

    TestBed.flushEffects();

    http
      .expectOne('http://api.test/v1/patients/patient-2')
      .flush({ ...PATIENT, id: 'patient-2', numeroHistoria: 'HC-000002' });
    http
      .expectOne('http://api.test/v1/patients/patient-2/clinical-record')
      .flush({ statusCode: 404, error: 'PatientClinicalRecordNotFoundError', message: 'x' }, { status: 404, statusText: 'Not Found' });

    expect(store.patientId()).toBe('patient-2');
    expect(store.patient()?.numeroHistoria).toBe('HC-000002');
    expect(store.record()).toBeNull();
    expect(store.loading()).toBe(false);
  });
});
