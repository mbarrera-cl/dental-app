import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HlmToaster } from '@ui/sonner';

/**
 * Root component used only in standalone mode (`ng serve users`). When
 * federated, the shell renders the layout and only this remote's routes are
 * mounted — this component is never instantiated.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HlmToaster],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet />
    <hlm-toaster [richColors]="true" />
  `,
})
export class App {}
