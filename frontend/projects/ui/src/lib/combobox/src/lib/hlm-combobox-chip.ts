import type { BooleanInput } from '@angular/cdk/coercion';
import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { BrnComboboxChip } from '@spartan-ng/brain/combobox';
import { classes } from '@ui/utils';
import { HlmComboboxChipRemove } from './hlm-combobox-chip-remove';

/** Selected value shown as a removable chip inside the chips box. */
@Component({
  selector: 'hlm-combobox-chip',
  exportAs: 'hlmComboboxChip',
  imports: [NgIcon, HlmComboboxChipRemove],
  providers: [provideIcons({ lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [{ directive: BrnComboboxChip, inputs: ['value'] }],
  host: { 'data-slot': 'combobox-chip' },
  template: `
    <ng-content />

    @if (showRemove()) {
      <button hlmComboboxChipRemove>
        <ng-icon name="lucideX" />
      </button>
    }
  `,
})
export class HlmComboboxChip {
  public readonly showRemove = input<boolean, BooleanInput>(true, { transform: booleanAttribute });

  constructor() {
    classes(
      () =>
        'bg-secondary text-secondary-foreground inline-flex h-6 w-fit shrink-0 items-center gap-0.5 rounded-4xl ps-2.5 pe-1 text-xs font-medium has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-disabled:opacity-50',
    );
  }
}
