import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideAppTransloco } from 'ui';
import { App } from './app';

describe('App (shell)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideAppTransloco()],
    }).compileComponents();
  });

  it('renders the shell chrome: header, navigation, router outlet and shared toaster', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('header')).not.toBeNull();
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
    expect(compiled.querySelector('hlm-toaster')).not.toBeNull();
    expect(compiled.textContent).toContain('Usuarios');
    expect(compiled.textContent).toContain('Dashboard');
  });

  it('switches the shared language between Spanish and English', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('app-language-switcher button'),
    );
    const english = buttons.find((button) => button.textContent?.trim() === 'EN');
    expect(english).toBeDefined();

    english?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Users');
  });
});
