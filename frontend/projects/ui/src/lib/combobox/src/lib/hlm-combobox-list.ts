import { Directive } from '@angular/core';
import { BrnComboboxList } from '@spartan-ng/brain/combobox';
import { classes } from '@ui/utils';

@Directive({
  selector: '[hlmComboboxList]',
  exportAs: 'hlmComboboxList',
  hostDirectives: [{ directive: BrnComboboxList, inputs: ['id'] }],
  host: { 'data-slot': 'combobox-list' },
})
export class HlmComboboxList {
  constructor() {
    classes(() => 'max-h-64 overflow-y-auto overscroll-contain p-0.5');
  }
}
