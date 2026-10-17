import { Directive } from '@angular/core';
import { BrnComboboxContent } from '@spartan-ng/brain/combobox';
import { classes } from '@ui/utils';

@Directive({
  selector: '[hlmComboboxContent],hlm-combobox-content',
  exportAs: 'hlmComboboxContent',
  hostDirectives: [{ directive: BrnComboboxContent, inputs: ['id'] }],
  host: { 'data-slot': 'combobox-content' },
})
export class HlmComboboxContent {
  constructor() {
    classes(
      () =>
        'bg-popover text-popover-foreground z-50 flex w-(--brn-combobox-width) flex-col overflow-hidden rounded-md border p-1 shadow-md outline-none',
    );
  }
}
