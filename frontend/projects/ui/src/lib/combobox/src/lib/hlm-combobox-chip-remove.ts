import { Directive } from '@angular/core';
import { BrnComboboxChipRemove } from '@spartan-ng/brain/combobox';
import { classes } from '@ui/utils';

/** Removes the chip it lives in from the combobox value. */
@Directive({
  selector: 'button[hlmComboboxChipRemove]',
  exportAs: 'hlmComboboxChipRemove',
  hostDirectives: [BrnComboboxChipRemove],
  host: { 'data-slot': 'combobox-chip-remove' },
})
export class HlmComboboxChipRemove {
  constructor() {
    classes(
      () =>
        'text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 inline-flex size-5 shrink-0 items-center justify-center rounded-4xl transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 [&_ng-icon]:size-3',
    );
  }
}
