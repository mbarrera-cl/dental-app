import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import DOMPurify from 'dompurify';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@ui/button';

/** Tags the editor may produce; mirrors the backend allowlist. */
const ALLOWED_TAGS = [
  'p',
  'br',
  'div',
  'span',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'h3',
  'h4',
];

/**
 * Minimal WYSIWYG editor: a `contenteditable` surface driven by a small
 * toolbar built with the spartan button. It carries an HTML string in and out;
 * the value is sanitized with DOMPurify on render, and the server sanitizes it
 * again before storing it. No third-party editor dependency.
 */
@Component({
  selector: 'app-rich-text-editor',
  imports: [HlmButton, TranslocoPipe],
  templateUrl: './rich-text-editor.html',
  styles: [
    `[contenteditable][data-placeholder]:empty::before {
      content: attr(data-placeholder);
      color: var(--muted-foreground);
    }`,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RichTextEditor implements AfterViewInit {
  readonly value = input<string | null>(null);
  readonly placeholder = input('');
  readonly disabled = input(false);
  readonly valueChange = output<string>();

  private readonly editor = viewChild<ElementRef<HTMLDivElement>>('editor');

  constructor() {
    // Keep the surface in sync when the bound value changes from the outside.
    effect(() => {
      const desired = DOMPurify.sanitize(this.value() ?? '', {
        ALLOWED_TAGS,
        ALLOWED_ATTR: [],
      });
      const element = this.editor()?.nativeElement;

      if (element !== undefined && element.innerHTML !== desired) {
        element.innerHTML = desired;
      }
    });
  }

  ngAfterViewInit(): void {
    const element = this.editor()?.nativeElement;

    if (element !== undefined) {
      element.innerHTML = DOMPurify.sanitize(this.value() ?? '', {
        ALLOWED_TAGS,
        ALLOWED_ATTR: [],
      });
    }
  }

  protected format(command: string): void {
    if (this.disabled()) {
      return;
    }

    const element = this.editor()?.nativeElement;

    if (element === undefined) {
      return;
    }

    element.focus();
    document.execCommand(command, false);
    this.emit();
  }

  protected onInput(): void {
    this.emit();
  }

  private emit(): void {
    const element = this.editor()?.nativeElement;

    if (element !== undefined) {
      this.valueChange.emit(element.innerHTML);
    }
  }
}
