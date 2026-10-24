import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideAppTransloco, provideSpartanHlm } from 'ui';
import type { Patient } from 'data-access';
import { PatientsPage } from './patients-page';

const PATIENTS: Patient[] = [
  {
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
    createdAt: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'patient-2',
    rut: '22222222-2',
    nombres: 'Grace',
    apellidoPaterno: 'Soto',
    apellidoMaterno: 'Muñoz',
    fechaNacimiento: '1985-11-02',
    sexo: 'femenino',
    email: 'grace@example.com',
    telefono: null,
    direccion: null,
    prevision: { tipo: 'ISAPRE', tramo: null, plan: 'Colmena Plus', convenio: null },
    contactoEmergencia: null,
    notas: null,
    numeroHistoria: 'HC-000002',
    createdAt: '2026-10-02T08:00:00.000Z',
  },
];

describe('PatientsPage', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatientsPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideAppTransloco(),
        provideSpartanHlm(),
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  async function render() {
    const fixture = TestBed.createComponent(PatientsPage);
    fixture.detectChanges();

    http.expectOne('http://localhost:3000/patients').flush(PATIENTS);

    await fixture.whenStable();
    fixture.detectChanges();

    return fixture;
  }

  it('shows skeleton rows while loading', () => {
    const fixture = TestBed.createComponent(PatientsPage);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);

    http.expectOne('http://localhost:3000/patients').flush([]);
  });

  it('renders the patients returned by the API with formatted RUTs', async () => {
    const fixture = await render();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Camila Rojas Pérez');
    expect(compiled.textContent).toContain('12.345.678-5');
    expect(compiled.textContent).toContain('Grace Soto Muñoz');
    expect(compiled.textContent).toContain('22.222.222-2');
    expect(compiled.textContent).toContain('FONASA · B');
    expect(compiled.textContent).toContain('Colmena Plus');
    expect(compiled.textContent).toContain('HC-000001');
    expect(compiled.textContent).toContain('HC-000002');
    expect(compiled.textContent).toContain('2 de 2 pacientes');
  });

  it('hides the clinical record shortcut without clinical:read', async () => {
    const fixture = await render();
    const compiled = fixture.nativeElement as HTMLElement;

    // The session of this test has no permissions, so the structural
    // directive must not render the shortcut at all.
    expect(compiled.querySelector('[data-testid^="patient-clinical-"]')).toBeNull();
  });

  it('filters by RUT digits regardless of the spelling', async () => {
    const fixture = await render();
    const compiled = fixture.nativeElement as HTMLElement;

    const input = compiled.querySelector<HTMLInputElement>('[data-testid="patients-search"]');
    expect(input).not.toBeNull();

    input!.value = '22.222.222';
    input!.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(compiled.textContent).toContain('Grace Soto Muñoz');
    expect(compiled.textContent).not.toContain('Camila Rojas Pérez');
    expect(compiled.textContent).toContain('1 de 2 pacientes');
  });

  it('paginates long lists ten at a time', async () => {
    const fixture = TestBed.createComponent(PatientsPage);
    fixture.detectChanges();

    const many = Array.from({ length: 12 }, (_, index) => ({
      ...PATIENTS[0]!,
      id: `patient-${index}`,
      nombres: `Paciente ${index}`,
      numeroHistoria: `HC-${String(index).padStart(6, '0')}`,
    }));

    http.expectOne('http://localhost:3000/patients').flush(many);
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('tbody tr')).toHaveLength(10);
    expect(compiled.textContent).not.toContain('Paciente 10');

    const next = compiled.querySelector<HTMLButtonElement>(
      'button[aria-label="Página siguiente"]',
    );
    next!.click();
    fixture.detectChanges();

    expect(compiled.textContent).toContain('Paciente 10');
    expect(compiled.textContent).toContain('Página 2 de 2');
  });

  it('shows an error banner when the API fails and retries', async () => {
    const fixture = TestBed.createComponent(PatientsPage);
    fixture.detectChanges();

    http
      .expectOne('http://localhost:3000/patients')
      .flush({ statusCode: 500, message: 'boom' }, { status: 500, statusText: 'Server Error' });

    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Ha ocurrido un error inesperado.');
    expect(compiled.textContent).toContain('Reintentar');
  });
});
