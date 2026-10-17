import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL, type ActivityEntry, type ActivityPage } from 'data-access';
import { provideAppTransloco, provideSpartanHlm } from 'ui';
import { ActivityMenu } from './activity-menu';

const BASE_URL = 'http://api.test';

const ENTRY: ActivityEntry = {
  id: 'a-1',
  // Future-dated so the unseen badge is visible regardless of the test clock.
  at: new Date(Date.now() + 60_000).toISOString(),
  actor: { id: 'user-1', type: 'user', name: 'Ana Pérez', email: 'ana@test.cl' },
  action: 'patients.create',
  module: 'patients',
  subject: { type: 'patient', id: null, label: 'Camila Rojas' },
  outcome: 'success',
  statusCode: 201,
  method: 'POST',
  path: '/patients',
  route: '/patients',
  ip: null,
  userAgent: null,
  metadata: {},
};

function page(items: ActivityEntry[]): ActivityPage {
  return {
    config: { enabled: true, panelLimit: 20, refreshSeconds: 0, badge: true },
    items,
    nextCursor: null,
  };
}

describe('ActivityMenu', () => {
  let fixture: ComponentFixture<ActivityMenu>;
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [ActivityMenu],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAppTransloco(),
        provideSpartanHlm(),
        { provide: API_BASE_URL, useValue: BASE_URL },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ActivityMenu);
    http = TestBed.inject(HttpTestingController);
  });

  function flushInitial(items: ActivityEntry[]): void {
    fixture.detectChanges();
    http.expectOne((request) => request.url === `${BASE_URL}/activity`).flush(page(items));
    fixture.detectChanges();
  }

  it('renders the header trigger with an accessible label', () => {
    flushInitial([]);

    const trigger = fixture.nativeElement.querySelector(
      '[data-testid="activity-menu-trigger"]',
    ) as HTMLButtonElement | null;

    expect(trigger).not.toBeNull();
    expect(trigger?.getAttribute('aria-label')).toBeTruthy();
  });

  it('opens the panel and lists entries with actor, action and time', () => {
    flushInitial([ENTRY]);

    const trigger = fixture.nativeElement.querySelector(
      '[data-testid="activity-menu-trigger"]',
    ) as HTMLButtonElement;

    trigger.click();
    http.expectOne((request) => request.url === `${BASE_URL}/activity`).flush(page([ENTRY]));
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('[data-testid="activity-menu-panel"]');
    expect(panel).not.toBeNull();

    const text = (panel as HTMLElement).textContent ?? '';
    expect(text).toContain('Ana Pérez');
    expect(text).toContain('Camila Rojas');

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[data-testid="activity-item"]')).toHaveLength(1);
  });

  it('shows the empty state', () => {
    flushInitial([]);

    const trigger = fixture.nativeElement.querySelector(
      '[data-testid="activity-menu-trigger"]',
    ) as HTMLButtonElement;

    trigger.click();
    http.expectOne((request) => request.url === `${BASE_URL}/activity`).flush(page([]));
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="activity-menu-empty"]'),
    ).not.toBeNull();
  });

  it('shows the unseen badge', () => {
    flushInitial([ENTRY]);

    expect(fixture.nativeElement.querySelector('[data-testid="activity-unread"]')).not.toBeNull();
  });
});
