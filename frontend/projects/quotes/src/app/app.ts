import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Root component used only in standalone mode (`ng serve quotes`). When
 * federated, the shell renders the layout and only this remote's routes are
 * mounted — this component is never instantiated.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <router-outlet /> `,
})
export class App {}
