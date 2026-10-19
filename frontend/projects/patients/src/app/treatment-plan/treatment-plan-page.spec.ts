import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { WritableSignal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  API_BASE_URL,
  type ClinicalRecord,
  type Quote,
  type TreatmentPlan,
  type TreatmentPlanItem,
} from 'data-access';
import { provideAppTransloco, provideSpartanHlm } from 'ui';
import { ClinicalRecordStore } from '../clinical-record.store';
import { TreatmentPlanPage } from './treatment-plan-page';

const BASE_URL = 'http://api.test/v1';
const PATIENT_ID = 'patient-1';
const RECORD_ID = 'record-1';
const PLAN_URL = `${BASE_URL}/clinical-records/${RECORD_ID}/treatment-plan`;
const IMPORT_URL = `${PLAN_URL}/import`;
const PREVIEW_URL = `${PLAN_URL}/import/preview`;
const EVENTS_URL = `${BASE_URL}/clinical-records/${RECORD_ID}/events`;
const QUOTES_URL = `${BASE_URL}/quotes?patientId=${PATIENT_ID}&status=aprobada`;

const RECORD = { id: RECORD_ID, status: 'borrador' } as unknown as ClinicalRecord;
const FINALIZED = { ...RECORD, status: 'finalizada' } as unknown as ClinicalRecord;

const PLAN: TreatmentPlan = {
  id: 'plan-1',
  recordId: RECORD_ID,
  notes: null,
  notesUpdatedAt: null,
  notesUpdatedBy: null,
  createdAt: '2026-10-16T10:00:00.000Z',
  updatedAt: '2026-10-16T10:00:00.000Z',
  items: [],
};

const ITEM: TreatmentPlanItem = {
  id: 'item-1',
  planId: 'plan-1',
  tooth: 36,
  procedure: 'Endodoncia pieza 36',
  ucoCode: 'ENDO-MOLAR',
  status: 'pendiente',
  notes: null,
  position: 0,
  sourceQuoteItemId: 'qitem-1',
  createdBy: 'user-1',
  updatedBy: 'user-1',
  createdAt: '2026-10-16T10:00:00.000Z',
  updatedAt: '2026-10-16T10:00:00.000Z',
  statusChangedAt: null,
  statusChangedBy: null,
  realizadoAt: null,
  realizadoBy: null,
  notesUpdatedAt: null,
  notesUpdatedBy: null,
  deletedAt: null,
  deletedBy: null,
  deletedReason: null,
  isDeleted: false,
};

const QUOTE = { id: 'quote-1', folio: 'P-000001', total: 100_000 } as unknown as Quote;

/** Protected members exercised through a cast: this spec is a regression guard. */
interface PageHandle {
  changeStatus(item: TreatmentPlanItem, status: string): void;
  openImport(): void;
  readQuoteId(event: Event): void;
  confirmImport(): void;
  openDelete(item: TreatmentPlanItem): void;
  readReason(event: Event): void;
  confirmDelete(): void;
  toggleTrash(): void;
  restore(item: TreatmentPlanItem): void;
  importOpen: WritableSignal<boolean>;
  selectedQuoteId: WritableSignal<string>;
  deleteReason: WritableSignal<string>;
  showTrash: WritableSignal<boolean>;
}

function inputEvent(value: string): Event {
  const target = { value } as HTMLInputElement;

  return { target } as unknown as Event;
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
    store.patientId.set(PATIENT_ID);
    store.record.set(RECORD);
    store.plan.set({ ...PLAN, items: [ITEM] });
  });

  afterEach(() => http.verify());

  function render(): { fixture: ComponentFixture<TreatmentPlanPage>; page: PageHandle } {
    const fixture = TestBed.createComponent(TreatmentPlanPage);
    fixture.detectChanges();

    return { fixture, page: fixture.componentInstance as unknown as PageHandle };
  }

  it('renders the imported items with tooth, code and procedure', () => {
    const { fixture } = render();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('[data-testid="plan-item-tooth"]')?.textContent).toContain('36');
    expect(element.querySelector('[data-testid="plan-item-code"]')?.textContent).toContain(
      'ENDO-MOLAR',
    );
    expect(element.querySelector('[data-testid="plan-item-procedure"]')?.textContent).toContain(
      'Endodoncia pieza 36',
    );
  });

  it('does not offer the manual add form neither the import on a finalized record', () => {
    store.record.set(FINALIZED);
    const { fixture } = render();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('[data-testid="plan-readonly-notice"]')).not.toBeNull();
    expect(element.querySelector('[data-testid="plan-import"]')).toBeNull();
    expect(element.querySelector('[data-testid="plan-item-delete-item-1"]')).toBeNull();
  });

  it('advances the status through the API', () => {
    const { page } = render();

    page.changeStatus(ITEM, 'realizado');

    const patch = http.expectOne(`${BASE_URL}/treatment-plan-items/${ITEM.id}`);
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ status: 'realizado' });
    patch.flush({ ...ITEM, status: 'realizado', realizadoAt: '2026-10-18T12:00:00.000Z' });
    http.expectOne(PLAN_URL).flush({ ...PLAN, items: [{ ...ITEM, status: 'realizado' }] });
    http.expectOne(EVENTS_URL).flush([]);
  });

  it('imports the chosen lines of an approved quotation', () => {
    const { page } = render();

    page.openImport();
    expect(page.importOpen()).toBe(true);
    http.expectOne(QUOTES_URL).flush([QUOTE]);

    page.readQuoteId(inputEvent(QUOTE.id));
    expect(page.selectedQuoteId()).toBe(QUOTE.id);

    const preview = http.expectOne(PREVIEW_URL);
    expect(preview.request.body).toEqual({ quoteId: QUOTE.id });
    preview.flush({
      quoteId: QUOTE.id,
      folio: QUOTE.folio,
      items: [
        {
          quoteItemId: 'qitem-1',
          ucoCode: 'ENDO-MOLAR',
          description: 'Endodoncia pieza 36',
          tooth: 36,
          flag: 'nuevo',
        },
      ],
    });
    page.confirmImport();
    const imported = http.expectOne(IMPORT_URL);
    expect(imported.request.body).toEqual({ quoteId: QUOTE.id, itemIds: ['qitem-1'] });
    imported.flush([ITEM]);
    http.expectOne(PLAN_URL).flush({ ...PLAN, items: [ITEM] });
    http.expectOne(`${PLAN_URL}?deleted=true`).flush(PLAN);
    http.expectOne(EVENTS_URL).flush([]);

    expect(page.importOpen()).toBe(false);
  });

  it('soft-deletes an item only with a reason', () => {
    const { page } = render();

    page.openDelete(ITEM);
    expect(page.deleteReason()).toBe('');

    page.readReason(inputEvent('Duplicado'));
    page.confirmDelete();

    const request = http.expectOne(`${BASE_URL}/treatment-plan-items/${ITEM.id}`);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.body).toEqual({ reason: 'Duplicado' });
    request.flush({ ...ITEM, isDeleted: true, deletedReason: 'Duplicado' });
    http.expectOne(PLAN_URL).flush(PLAN);
    http
      .expectOne(`${PLAN_URL}?deleted=true`)
      .flush({ ...PLAN, items: [{ ...ITEM, isDeleted: true }] });
    http.expectOne(EVENTS_URL).flush([]);
  });

  it('toggles the trash and restores an item', () => {
    const { page } = render();

    page.toggleTrash();
    expect(page.showTrash()).toBe(true);
    http
      .expectOne(`${PLAN_URL}?deleted=true`)
      .flush({ ...PLAN, items: [{ ...ITEM, isDeleted: true, deletedReason: 'x' }] });

    page.restore({ ...ITEM, isDeleted: true });
    const request = http.expectOne(`${BASE_URL}/treatment-plan-items/${ITEM.id}/restore`);
    expect(request.request.method).toBe('POST');
    request.flush(ITEM);
    http.expectOne(PLAN_URL).flush({ ...PLAN, items: [ITEM] });
    http.expectOne(`${PLAN_URL}?deleted=true`).flush(PLAN);
    http.expectOne(EVENTS_URL).flush([]);
  });
});
