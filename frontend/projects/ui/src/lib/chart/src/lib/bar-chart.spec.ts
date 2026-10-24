import { TestBed } from '@angular/core/testing';
import { BarChart } from './bar-chart';

describe('BarChart', () => {
  it('renders a full-width chart with the provided data', async () => {
    await TestBed.configureTestingModule({ imports: [BarChart] }).compileComponents();

    const fixture = TestBed.createComponent(BarChart);
    fixture.componentRef.setInput('data', [
      { label: 'Lun', value: 8 },
      { label: 'Mar', value: 5 },
    ]);
    fixture.componentRef.setInput('ariaLabel', 'Citas por día');
    fixture.detectChanges();
    await fixture.whenStable();

    const chart = (fixture.nativeElement as HTMLElement).querySelector('tanstack-chart');

    expect(chart).not.toBeNull();
    expect(chart?.classList.contains('w-full')).toBe(true);
  });
});
