import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { SessionStore } from 'auth';
import { provideSpartanHlm } from 'ui';
import type { Setting } from 'data-access';
import { AgendaSettingsPage } from './agenda-settings-page';

const BASE = 'http://localhost:3000';
const SETTINGS_URL = `${BASE}/settings`;

const SETTINGS: Setting[] = [
  setting('agenda.notifyPatient', true),
  setting('agenda.notifyProfessional', true),
  setting('agenda.defaultDurationMinutes', 30),
  setting('agenda.confirmationSubject', 'Hora {{estado}}'),
  setting('agenda.confirmationHtml', '<p>Hola {{paciente}}</p>'),
];

function setting(key: string, value: string | number | boolean): Setting {
  return {
    key,
    group: 'agenda',
    type: typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : key.endsWith('Html') ? 'html' : 'string',
    value,
    default: value,
    description: key,
  };
}

interface PageHandle {
  form: () => { notifyPatient: boolean; confirmationSubject: string };
  set(key: string, value: unknown): void;
  save(): void;
}

describe('AgendaSettingsPage', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgendaSettingsPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideSpartanHlm(),
        { provide: SessionStore, useValue: { has: () => true } },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  it('loads the agenda settings and saves them', () => {
    const fixture = TestBed.createComponent(AgendaSettingsPage);
    fixture.detectChanges();
    http.expectOne(SETTINGS_URL).flush(SETTINGS);
    http
      .expectOne(`${BASE}/agenda/reasons`)
      .flush([{ id: 'reason-1', name: 'Control', createdAt: '', updatedAt: '' }]);
    fixture.detectChanges();

    const page = fixture.componentInstance as unknown as PageHandle;
    expect(page.form().notifyPatient).toBe(true);
    expect(page.form().confirmationSubject).toBe('Hora {{estado}}');

    page.set('notifyPatient', false);
    page.save();

    const request = http.expectOne(SETTINGS_URL);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toMatchObject({
      values: {
        'agenda.notifyPatient': false,
        'agenda.notifyProfessional': true,
        'agenda.defaultDurationMinutes': 30,
      },
    });
    request.flush(SETTINGS);
  });
});
