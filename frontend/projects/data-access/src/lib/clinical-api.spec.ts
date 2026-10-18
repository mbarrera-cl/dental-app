import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from './api-base-url';
import { ClinicalApi } from './clinical-api';
import {
  ANTECEDENTES,
  PIEZAS_HIGIENE_ORAL,
  REGIONES_ESTOMATOGNATICAS,
  type AntecedentesRecord,
  type ClinicalFinding,
  type ClinicalIndices,
  type ClinicalRecord,
  type HigieneOralRecord,
  type RegionesRecord,
} from './clinical.model';

const BASE_URL = 'http://api.test/v1/';
const RECORD_ID = 'record-1';
const PATIENT_ID = 'patient-1';

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
      presionArterialSistolica: 120,
      presionArterialDiastolica: 80,
      frecuenciaCardiaca: 72,
      temperatura: 36.5,
      frecuenciaRespiratoria: 16,
    },
    examenEstomatognatico: { regiones, descripcion: null },
    indicadores: { higieneOral, enfermedadPeriodontal: null, maloclusion: null, fluorosis: null },
    createdBy: 'user-1',
    updatedBy: null,
    createdAt: '2026-10-16T10:00:00.000Z',
    updatedAt: '2026-10-16T10:00:00.000Z',
    finalizedAt: null,
    finalizedBy: null,
    integrityHash: null,
  };
}

const FINDING: ClinicalFinding = {
  id: 'finding-1',
  recordId: RECORD_ID,
  tooth: 36,
  surfaces: ['O'],
  symbol: 'caries',
  state: 'a-realizar',
  recesion: 1,
  movilidad: null,
  note: null,
  createdBy: 'user-1',
  createdAt: '2026-10-16T10:00:00.000Z',
  voidedAt: null,
  voidedBy: null,
  isVoided: false,
};

const INDICES: ClinicalIndices = {
  permanentes: { cariados: [36], perdidos: [], obturados: [16], total: 2 },
  temporales: { cariados: [], perdidos: [], obturados: [], total: 0 },
  higieneOral: { placa: 0, calculo: 0, gingivitis: 0, total: 0 },
};

describe('ClinicalApi', () => {
  let api: ClinicalApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE_URL },
      ],
    });

    api = TestBed.inject(ClinicalApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('opens the record of a patient with a POST', () => {
    let received: ClinicalRecord | undefined;
    api.createForPatient(PATIENT_ID, { categoria: '5-9-programado' }).subscribe((record) => {
      received = record;
    });

    const request = http.expectOne(`http://api.test/v1/patients/${PATIENT_ID}/clinical-record`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ categoria: '5-9-programado' });

    request.flush(buildRecord());
    expect(received?.id).toBe(RECORD_ID);
  });

  it('reads the record of a patient and the record by id', () => {
    api.getForPatient(PATIENT_ID).subscribe();
    http
      .expectOne(`http://api.test/v1/patients/${PATIENT_ID}/clinical-record`)
      .flush(buildRecord());

    api.getById(RECORD_ID).subscribe();
    const request = http.expectOne(`http://api.test/v1/clinical-records/${RECORD_ID}`);
    expect(request.request.method).toBe('GET');
    request.flush(buildRecord());
  });

  it('patches a record with only the changed sections', () => {
    api.update(RECORD_ID, { motivoConsulta: 'Dolor en pieza 36' }).subscribe();

    const request = http.expectOne(`http://api.test/v1/clinical-records/${RECORD_ID}`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ motivoConsulta: 'Dolor en pieza 36' });

    request.flush(buildRecord());
  });

  it('lists and appends odontogram findings', () => {
    api.listFindings(RECORD_ID).subscribe((findings) => expect(findings).toEqual([FINDING]));
    http.expectOne(`http://api.test/v1/clinical-records/${RECORD_ID}/findings`).flush([FINDING]);

    api
      .addFinding(RECORD_ID, { tooth: 36, surfaces: ['O'], symbol: 'caries', recesion: 1 })
      .subscribe();
    const request = http.expectOne(`http://api.test/v1/clinical-records/${RECORD_ID}/findings`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ tooth: 36, surfaces: ['O'], symbol: 'caries', recesion: 1 });
    request.flush(FINDING);
  });

  it('voids a finding (append-only) and reads it back', () => {
    api.voidFinding(RECORD_ID, 'finding-1').subscribe((finding) => {
      expect(finding.isVoided).toBe(true);
    });

    const request = http.expectOne(
      `http://api.test/v1/clinical-records/${RECORD_ID}/findings/finding-1/void`,
    );
    expect(request.request.method).toBe('POST');
    request.flush({ ...FINDING, isVoided: true, voidedAt: '2026-10-16T11:00:00.000Z' });
  });

  it('reads the derived indices and the audit events', () => {
    api.getIndices(RECORD_ID).subscribe((indices) => expect(indices).toEqual(INDICES));
    http.expectOne(`http://api.test/v1/clinical-records/${RECORD_ID}/indices`).flush(INDICES);

    api.listEvents(RECORD_ID).subscribe();
    http.expectOne(`http://api.test/v1/clinical-records/${RECORD_ID}/events`).flush([]);
  });
});
