import { Directive } from '@angular/core';
import { BrnComboboxChipInput } from '@spartan-ng/brain/combobox';
import { classes } from '@ui/utils';

/** Search field rendered inline with the chips. */
@Directive({
  selector: 'input[hlmComboboxChipInput]',
  exportAs: 'hlmComboboxChipInput',
  hostDirectives: [{ directive: BrnComboboxChipInput, inputs: ['id', 'aria-invalid'] }],
  host: { 'data-slot': 'combobox-chip-input' },
})
export class HlmComboboxChipInput {
  constructor() {
    classes(
      () => 'placeholder:text-muted-foreground min-w-16 flex-1 bg-transparent text-sm outline-none',
    );
  }
}
