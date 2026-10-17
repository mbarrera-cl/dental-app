import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { PrintHeaderComponent, type ClinicPrintData } from './print-header.component';

describe('PrintHeaderComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrintHeaderComponent],
    }).compileComponents();
  });

  const render = async (data: ClinicPrintData) => {
    const fixture = TestBed.createComponent(PrintHeaderComponent);

    fixture.componentRef.setInput('data', data);
    await fixture.whenStable();
    fixture.detectChanges();

    return fixture;
  };

  it('renders the logo, the name and every contact line', async () => {
    const fixture = await render({
      name: 'Clínica Los Andes',
      slogan: 'Odontología familiar',
      logoUrl: 'http://api.test/clinic/assets/print?v=1',
      rut: '76.543.210-K',
      address: 'Av. Providencia 1234, Oficina 401 · Providencia, RM',
      phone: '+56 9 1234 5678',
      email: 'contacto@losandes.cl',
      website: 'https://losandes.cl',
    });

    const compiled = fixture.nativeElement as HTMLElement;
    const logo = compiled.querySelector('img');

    expect(logo?.getAttribute('src')).toBe('http://api.test/clinic/assets/print?v=1');
    expect(compiled.textContent).toContain('Clínica Los Andes');
    expect(compiled.textContent).toContain('Odontología familiar');
    expect(compiled.textContent).toContain('RUT 76.543.210-K');
    expect(compiled.textContent).toContain('Av. Providencia 1234, Oficina 401 · Providencia, RM');
    expect(compiled.textContent).toContain('+56 9 1234 5678 · contacto@losandes.cl · https://losandes.cl');
  });

  it('omits the empty lines and survives an unbranded clinic', async () => {
    const fixture = await render({ name: 'Mi clínica' });

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('img')).toBeNull();
    expect(compiled.textContent).toContain('Mi clínica');
    expect(compiled.textContent).not.toContain('RUT');
    expect(compiled.textContent?.trim()).toBe('Mi clínica');
  });

  it('only exists on paper', async () => {
    const fixture = await render({ name: 'Mi clínica' });

    expect(fixture.nativeElement.classList.contains('hidden')).toBe(true);
    expect(fixture.nativeElement.classList.contains('print:block')).toBe(true);
  });
});
