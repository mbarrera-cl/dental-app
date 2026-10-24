import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideSpartanHlm } from '../../utils/src';
import { PkComposer } from './pk-composer';

@Component({
  imports: [PkComposer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <pk-composer [hideTextarea]="hideTextarea()">
      <span pkComposerTop data-testid="composer-top">top</span>
      <span pkComposerStart data-testid="composer-start">start</span>
      <span pkComposerEnd data-testid="composer-end">end</span>
    </pk-composer>
  `,
})
class ComposerHost {
  readonly hideTextarea = signal(false);
}

describe('PkComposer', () => {
  let fixture: ComponentFixture<ComposerHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComposerHost],
      providers: [provideSpartanHlm()],
    }).compileComponents();

    fixture = TestBed.createComponent(ComposerHost);
    fixture.detectChanges();
  });

  const compiled = (): HTMLElement => fixture.nativeElement as HTMLElement;

  it('hides the text box without dropping the projected slots', () => {
    expect(compiled().querySelector('textarea')).not.toBeNull();

    fixture.componentInstance.hideTextarea.set(true);
    fixture.detectChanges();

    expect(compiled().querySelector('textarea')).toBeNull();
    expect(compiled().querySelector('[data-testid="composer-top"]')).not.toBeNull();
    expect(compiled().querySelector('[data-testid="composer-start"]')).not.toBeNull();
    expect(compiled().querySelector('[data-testid="composer-end"]')).not.toBeNull();

    fixture.componentInstance.hideTextarea.set(false);
    fixture.detectChanges();

    expect(compiled().querySelector('textarea')).not.toBeNull();
  });
});
