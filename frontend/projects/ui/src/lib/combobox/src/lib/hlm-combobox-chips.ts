import type { BooleanInput } from '@angular/cdk/coercion';
import { booleanAttribute, computed, Directive, input } from '@angular/core';
import {
  BrnComboboxAnchor,
  BrnComboboxPopoverTrigger,
  injectBrnComboboxBase,
} from '@spartan-ng/brain/combobox';
import { classes } from '@ui/utils';

/**
 * Input-like box that holds the selected chips plus the search input. It is
 * the popover anchor and trigger, so clicking anywhere on it opens the panel.
 */
@Directive({
  selector: '[hlmComboboxChips],hlm-combobox-chips',
  exportAs: 'hlmComboboxChips',
  hostDirectives: [BrnComboboxAnchor, BrnComboboxPopoverTrigger],
  host: {
    'data-slot': 'combobox-chips',
    '[attr.data-matches-spartan-invalid]': '_spartanInvalid() ? "true" : null',
  },
})
export class HlmComboboxChips {
  private readonly _combobox = injectBrnComboboxBase();

  public readonly forceInvalid = input<boolean, BooleanInput>(false, { transform: booleanAttribute });

  protected readonly _spartanInvalid = computed(
    () => this.forceInvalid() || this._combobox.controlState?.()?.spartanInvalid,
  );

  constructor() {
    classes(
      () =>
        'border-input dark:bg-input/30 focus-within:border-ring focus-within:ring-ring/50 data-[matches-spartan-invalid=true]:border-destructive data-[matches-spartan-invalid=true]:ring-destructive/20 flex min-h-9 w-full cursor-text flex-wrap items-center gap-1.5 rounded-md border bg-transparent px-2 py-1 text-base shadow-xs transition-[color,box-shadow] focus-within:ring-3 data-[matches-spartan-invalid=true]:ring-3 md:text-sm',
    );
  }
}
