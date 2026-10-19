import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { FormControl, FormGroup } from '@angular/forms';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  API_BASE_URL,
  type ClinicalRecord,
  type TreatmentPlan,
  type TreatmentPlanItem,
} from 'data-access';
import { provideAppTransloco, provideSpartanHlm } from 'ui';
import { ClinicalRecordStore } from '../clinical-record.store';
import { TreatmentPlanPage } from './treatment-plan-page';

const BASE_URL = 'http://api.test/v1';
const RECORD_ID = 'record-1';
const ITEMS_URL = `${BASE_URL}/clinical-records/${RECORD_ID}/treatment-plan/items`;
const PLAN_URL = `${BASE_URL}/clinical-records/${RECORD_ID}/treatment-plan`;
const EVENTS_URL = `${BASE_URL}/clinical-records/${RECORD_ID}/events`;

const RECORD = { id: RECORD_ID, status: 'borrador' } as unknown as ClinicalRecord;

const PLAN: TreatmentPlan = {
  id: 'plan-1',
  recordId: RECORD_ID,
  createdAt: '2026-10-16T10:00:00.000Z',
  updatedAt: '2026-10-16T10:00:00.000Z',
  items: [],
};

const ITEM: TreatmentPlanItem = {
  id: 'item-1',
  planId: 'plan-1',
  tooth: 36,
  procedure: 'Endodoncia pieza 36',
  ucoCode: null,
  status: 'planificado',
  notes: null,
  position: 0,
  createdBy: 'user-1',
  updatedBy: 'user-1',
  createdAt: '2026-10-16T10:00:00.000Z',
  updatedAt: '2026-10-16T10:00:00.000Z',
  statusChangedAt: null,
  statusChangedBy: null,
};

/** Protected members exercised through a cast: this spec is a regression guard. */
interface PageHandle {
  form: FormGroup<{
    tooth: FormControl<string>;
    procedure: FormControl<string>;
    notes: FormControl<string>;
  }>;
  toothError(): string | null;
  add(): void;
}

describe('TreatmentPlanPage', () => {
  let http: HttpTestingController;
  let store: ClinicalRecordStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TreatmentPlanPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAppTransloco(),
        provideSpartanHlm(),
        ClinicalRecordStore,
        { provide: API_BASE_URL, useValue: BASE_URL },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(ClinicalRecordStore);
    store.record.set(RECORD);
    store.plan.set(PLAN);
  });

  afterEach(() => http.verify());

  function render(): { fixture: ComponentFixture<TreatmentPlanPage>; page: PageHandle } {
    const fixture = TestBed.createComponent(TreatmentPlanPage);
    fixture.detectChanges();

    return { fixture, page: fixture.componentInstance as unknown as PageHandle };
  }

  /** Flushes the plan + events reloads triggered after a successful change. */
  function flushReloads(): void {
    http.expectOne(PLAN_URL).flush(PLAN);
    http.expectOne(EVENTS_URL).flush([]);
  }

  it('accepts the number the tooth input writes (regression: .trim on a number)', () => {
    const { page } = render();
    // `input[type=number]` stores a number, not a string.
    page.form.controls.tooth.setValue(36 as unknown as string);

    expect(page.toothError()).toBeNull();
  });

  it('flags an invalid numeric tooth', () => {
    const { page } = render();
    page.form.controls.tooth.setValue(99 as unknown as string);

    expect(page.toothError()).toBe('clinical.plan.validation.tooth');
  });

  it('does not submit while the tooth is invalid', () => {
    const { page } = render();
    page.form.controls.tooth.setValue(99 as unknown as string);
    page.form.controls.procedure.setValue('Endodoncia');

    page.add();

    http.expectNone(ITEMS_URL);
  });

  it('submits the procedure with the numeric tooth', () => {
    const { page } = render();
    page.form.controls.tooth.setValue(36 as unknown as string);
    page.form.controls.procedure.setValue('Endodoncia pieza 36');

    page.add();

    const request = http.expectOne(ITEMS_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      tooth: 36,
      procedure: 'Endodoncia pieza 36',
      notes: null,
    });
    request.flush(ITEM);
    flushReloads();
  });

  it('submits a whole-mouth procedure when the tooth is empty', () => {
    const { page } = render();
    page.form.controls.procedure.setValue('Profilaxis');

    page.add();

    const request = http.expectOne(ITEMS_URL);
    expect(request.request.body).toEqual({ tooth: null, procedure: 'Profilaxis', notes: null });
    request.flush({ ...ITEM, tooth: null, procedure: 'Profilaxis' });
    flushReloads();
  });

  it('adds an item typing a number in the tooth input (end-to-end form path)', () => {
    const { fixture } = render();

    const procedure = fixture.nativeElement.querySelector(
      '[data-testid="plan-procedure"]',
    ) as HTMLInputElement;
    const tooth = fixture.nativeElement.querySelector('[data-testid="plan-tooth"]') as HTMLInputElement;

    procedure.value = 'Endodoncia pieza 36';
    procedure.dispatchEvent(new Event('input'));
    tooth.value = '36';
    tooth.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );

    const request = http.expectOne(ITEMS_URL);
    expect(request.request.body).toEqual({
      tooth: 36,
      procedure: 'Endodoncia pieza 36',
      notes: null,
    });
    request.flush(ITEM);
    flushReloads();
  });
});
