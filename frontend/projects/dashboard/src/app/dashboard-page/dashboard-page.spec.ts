import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideAppTransloco, provideSpartanHlm } from 'ui';
import type { DashboardSummary } from 'data-access';
import { DashboardPage } from './dashboard-page';

const SUMMARY: DashboardSummary = {
  window: {
    today: '2026-10-18T03:00:00.000Z',
    monthStart: '2026-10-01T03:00:00.000Z',
  },
  patients: {
    total: 12,
    newLast30Days: 3,
    prevision: [
      { tipo: 'FONASA', count: 7 },
      { tipo: 'ISAPRE', count: 2 },
      { tipo: 'CONVENIO', count: 1 },
      { tipo: 'PARTICULAR', count: 2 },
    ],
  },
  cash: {
    outstanding: 45000,
    chargesMonth: 120000,
    collectionsToday: [
      { method: 'efectivo', total: 15000 },
      { method: 'tarjeta', total: 5000 },
      { method: 'transferencia', total: 0 },
    ],
    collectionsMonth: [
      { method: 'efectivo', total: 80000 },
      { method: 'tarjeta', total: 20000 },
      { method: 'transferencia', total: 20000 },
    ],
    topDebtors: [{ patientId: 'patient-1', patientName: 'Camila Rojas', balance: 30000 }],
  },
  quotes: {
    funnel: { borrador: 2, sin_respuesta: 3, aprobada: 4, rechazada: 1 },
    approvedMonth: 90000,
    conversionRate: 0.8,
    expiringSoon: 1,
  },
  agenda: {
    today: [{ status: 'scheduled', count: 5 }],
    cancelledMonth: 2,
    totalMonth: 20,
    next: [
      {
        id: 'appointment-1',
        startsAt: '2026-10-18T13:00:00.000Z',
        patientName: 'Camila Rojas',
        professionalName: 'Dra. Díaz',
        reason: 'Control',
      },
    ],
  },
  recentActivity: [
    {
      at: '2026-10-18T12:30:00.000Z',
      actor: 'Administrator',
      action: 'payments.payment.record',
      module: 'payments',
      subject: 'Camila Rojas',
      outcome: 'success',
    },
  ],
};

describe('DashboardPage', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardPage],
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
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();

    http.expectOne('http://localhost:3000/dashboard/summary').flush(SUMMARY);

    await fixture.whenStable();
    fixture.detectChanges();

    return fixture;
  }

  it('shows skeletons while the summary loads', () => {
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll('[data-slot="skeleton"]').length,
    ).toBeGreaterThan(0);

    http.expectOne('http://localhost:3000/dashboard/summary').flush(SUMMARY);
  });

  it('renders the KPI cards and the operational lists from one read', async () => {
    const fixture = await render();
    const compiled = fixture.nativeElement as HTMLElement;

    // Balance, today's collections, today's appointments and the approved month.
    expect(compiled.querySelector('[data-testid="dashboard-kpi-outstanding"]')?.textContent).toContain('45.000');
    expect(compiled.querySelector('[data-testid="dashboard-kpi-collections"]')?.textContent).toContain('20.000');
    expect(compiled.querySelector('[data-testid="dashboard-kpi-appointments"]')?.textContent).toContain('5');
    expect(compiled.querySelector('[data-testid="dashboard-kpi-approved"]')?.textContent).toContain('90.000');
    expect(compiled.querySelector('[data-testid="dashboard-kpi-approved"]')?.textContent).toContain('80%');

    // Lists.
    expect(compiled.textContent).toContain('Camila Rojas');
    expect(compiled.textContent).toContain('Dra. Díaz');
    expect(compiled.textContent).toContain('payments.payment.record');

    // Patient totals block.
    expect(compiled.querySelector('[data-testid="dashboard-patients-total"]')?.textContent).toContain('12');
  });

  it('shows the error banner but keeps the last summary when a refresh fails', async () => {
    const fixture = await render();
    const page = fixture.componentInstance as unknown as { load: (silent?: boolean) => void };

    page.load();
    fixture.detectChanges();
    http.expectOne('http://localhost:3000/dashboard/summary').flush('boom', {
      status: 500,
      statusText: 'Server Error',
    });

    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="dashboard-kpi-outstanding"]')?.textContent).toContain('45.000');
    expect(compiled.querySelector('[data-testid="dashboard-error"]')).not.toBeNull();
  });
});
