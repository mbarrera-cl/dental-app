import { Directive } from '@angular/core';
import { BrnComboboxEmpty } from '@spartan-ng/brain/combobox';
import { classes } from '@ui/utils';

/**
 * Shown only while the panel has no visible items: the combobox content
 * carries `data-empty` while the current search filters everything out.
 */
@Directive({
  selector: '[hlmComboboxEmpty],hlm-combobox-empty',
  exportAs: 'hlmComboboxEmpty',
  hostDirectives: [BrnComboboxEmpty],
  host: { 'data-slot': 'combobox-empty' },
})
export class HlmComboboxEmpty {
  constructor() {
    classes(() => 'text-muted-foreground hidden py-6 text-center text-sm in-data-[empty]:block');
  }
}
