import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { SessionStore } from 'auth';
import type { UcoProcedure } from 'data-access';
import { provideAppTransloco, provideSpartanHlm } from 'ui';
import { UcoPage } from './uco-page';

const BASE = 'http://localhost:3000';
const UCO_URL = `${BASE}/uco`;

const PROCEDURES: UcoProcedure[] = [
  {
    id: 'uco-1',
    code: '010001',
    chapter: '1',
    name: 'Consulta dental de urgencia',
    units: 1,
    status: 'active',
    createdAt: '2026-10-17T10:00:00.000Z',
    updatedAt: '2026-10-17T10:00:00.000Z',
  },
  {
    id: 'uco-2',
    code: '020001',
    chapter: '2',
    name: 'Obturación de una superficie',
    units: 2,
    status: 'active',
    createdAt: '2026-10-17T10:00:00.000Z',
    updatedAt: '2026-10-17T10:00:00.000Z',
  },
  {
    id: 'uco-3',
    code: '999001',
    chapter: '9',
    name: 'Prestación retirada',
    units: 3,
    status: 'inactive',
    createdAt: '2026-10-17T10:00:00.000Z',
    updatedAt: '2026-10-17T10:00:00.000Z',
  },
];

interface PageHandle {
  query: { (): string; set(value: string): void };
  includeInactive: { (): boolean; set(value: boolean): void };
  filtered: () => UcoProcedure[];
  openCreate(): void;
  submit(): void;
  form: {
    setValue(value: {
      code: string;
      chapter: string;
      name: string;
      units: number;
      active: boolean;
    }): void;
  };
}

describe('UcoPage', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UcoPage],
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

  function render(procedures: UcoProcedure[] = PROCEDURES): ComponentFixture<UcoPage> {
    const fixture = TestBed.createComponent(UcoPage);
    fixture.detectChanges();
    http.expectOne((req) => req.url === UCO_URL).flush(procedures);
    fixture.detectChanges();

    return fixture;
  }

  function handle(fixture: ComponentFixture<UcoPage>): PageHandle {
    return fixture.componentInstance as unknown as PageHandle;
  }

  function native(fixture: ComponentFixture<UcoPage>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the catalog rows', () => {
    const fixture = render();

    const rows = native(fixture).querySelectorAll('[data-testid="uco-row"]');
    expect(rows.length).toBe(3);
    expect(native(fixture).textContent).toContain('010001');
    expect(native(fixture).textContent).toContain('Obturación de una superficie');
  });

  it('filters by code or name', () => {
    const fixture = render();
    const page = handle(fixture);

    page.query.set('0200');
    fixture.detectChanges();

    expect(page.filtered().map((procedure) => procedure.code)).toEqual(['020001']);
  });

  it('hides inactive entries unless the toggle is on', () => {
    const fixture = render();
    const page = handle(fixture);

    page.includeInactive.set(false);
    fixture.detectChanges();

    expect(page.filtered().some((procedure) => procedure.status === 'inactive')).toBe(false);

    page.includeInactive.set(true);
    fixture.detectChanges();

    expect(page.filtered().some((procedure) => procedure.status === 'inactive')).toBe(true);
  });

  it('creates a procedure from the dialog', () => {
    const fixture = render();
    const page = handle(fixture);

    page.openCreate();
    fixture.detectChanges();

    page.form.setValue({
      code: '030001',
      chapter: '3',
      name: 'Endodoncia de incisivo',
      units: 6,
      active: true,
    });
    page.submit();

    const request = http.expectOne(UCO_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      code: '030001',
      chapter: '3',
      name: 'Endodoncia de incisivo',
      units: 6,
    });
    request.flush(PROCEDURES[0]);

    // The page reloads the catalog after a successful save.
    http.expectOne((r) => r.url === UCO_URL && r.method === 'GET').flush(PROCEDURES);
  });
});
