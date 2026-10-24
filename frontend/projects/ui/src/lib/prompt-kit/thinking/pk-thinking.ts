import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cn } from '../utils/cn';

/**
 * Short, non-blocking status for an assistant turn that is waiting for its
 * first token or running a tool. It is a live region so the phase change is
 * announced once, never on every streamed token.
 */
@Component({
  selector: 'pk-thinking',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': 'true',
    '[class]': 'computedClass()',
  },
  template: `
    <span class="pk-thinking-dots" aria-hidden="true">
      <span></span>
      <span></span>
      <span></span>
    </span>
    <span>{{ label() }}</span>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--muted-foreground);
      font-size: 0.875rem;
      line-height: 1.25rem;
    }

    .pk-thinking-dots {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }

    .pk-thinking-dots span {
      display: block;
      width: 0.3125rem;
      height: 0.3125rem;
      border-radius: 9999px;
      background: currentColor;
      opacity: 0.3;
      animation: pk-thinking-dot 1.2s ease-in-out infinite;
    }

    .pk-thinking-dots span:nth-child(2) {
      animation-delay: 0.15s;
    }

    .pk-thinking-dots span:nth-child(3) {
      animation-delay: 0.3s;
    }

    @keyframes pk-thinking-dot {
      0%,
      80%,
      100% {
        opacity: 0.3;
        transform: translateY(0);
      }
      40% {
        opacity: 1;
        transform: translateY(-2px);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .pk-thinking-dots span {
        animation: none;
        opacity: 0.65;
      }
    }
  `,
})
export class PkThinking {
  public readonly label = input('');
  public readonly class = input('');

  protected readonly computedClass = computed(() => cn(this.class()));
}
