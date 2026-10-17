// ngx-prompt-kit original — not part of ibelick/prompt-kit
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { cn } from '../utils/cn';
import { PkConversationItem, type ConversationRename } from './pk-conversation-item';
import type {
  Conversation,
  ConversationGroup,
  ConversationGroupKey,
} from './pk-conversation-types';

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function bucketFor(updatedAt: Date | string, now: Date): ConversationGroupKey {
  const t = typeof updatedAt === 'string' ? new Date(updatedAt) : updatedAt;
  const today = startOfDay(now);
  const stamp = startOfDay(t);
  const diff = today - stamp;
  if (diff <= 0) return 'today';
  if (diff === DAY) return 'yesterday';
  if (diff <= 7 * DAY) return 'last7';
  return 'older';
}

const GROUP_ORDER: ConversationGroupKey[] = ['today', 'yesterday', 'last7', 'older'];

@Component({
  selector: 'pk-conversation-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PkConversationItem],
  host: {
    '[class]': 'computedClass()',
  },
  template: `
    @if (groupBy() === 'date') {
      @for (group of groups(); track group.key) {
        <div class="flex flex-col gap-0.5">
          <p class="text-muted-foreground px-2.5 pt-3.5 pb-1.5 text-xs font-medium">
            {{ group.label }}
          </p>
          @for (c of group.items; track c.id) {
            <pk-conversation-item
              [conversation]="c"
              [isActive]="c.id === activeId()"
              [link]="link()?.(c) ?? null"
              [renameLabel]="renameLabel()"
              [deleteLabel]="deleteLabel()"
              [actionsLabel]="actionsLabel()"
              [renameAria]="renameAria()"
              (selected)="selected.emit($event)"
              (renamed)="renamed.emit($event)"
              (deleted)="deleted.emit($event)"
            />
          }
        </div>
      }
    } @else {
      <div class="flex flex-col gap-0.5">
        @for (c of visible(); track c.id) {
          <pk-conversation-item
            [conversation]="c"
            [isActive]="c.id === activeId()"
            [link]="link()?.(c) ?? null"
            (selected)="selected.emit($event)"
            (renamed)="renamed.emit($event)"
            (deleted)="deleted.emit($event)"
          />
        }
      </div>
    }
    @if (visible().length === 0) {
      <ng-content select="[pkConversationListEmpty]" />
    }
  `,
})
export class PkConversationList {
  public readonly conversations = input.required<readonly Conversation[]>();
  public readonly groupBy = input<'date' | 'none'>('date');
  public readonly activeId = input<string | null>(null);
  public readonly class = input<string>('');
  public readonly todayLabel = input('Today');
  public readonly yesterdayLabel = input('Yesterday');
  public readonly last7Label = input('Previous 7 days');
  public readonly olderLabel = input('Older');
  public readonly renameLabel = input('Rename');
  public readonly deleteLabel = input('Delete');
  public readonly actionsLabel = input('Conversation actions');
  public readonly renameAria = input('Rename conversation');
  /** Narrows the list to titles containing this text, ignoring case. */
  public readonly query = input<string>('');
  /**
   * Renders each row as a router link to the returned path, so a conversation can be opened in a
   * new tab. Without it the rows are buttons and only `selected` fires.
   */
  public readonly link = input<
    ((conversation: Conversation) => string | readonly unknown[]) | null
  >(null);

  public readonly selected = output<string>();
  public readonly renamed = output<ConversationRename>();
  public readonly deleted = output<string>();

  protected readonly computedClass = computed(() =>
    cn('flex h-full flex-col gap-2 overflow-y-auto p-2', this.class()),
  );

  protected readonly visible = computed(() => {
    const query = this.query().trim().toLocaleLowerCase();
    const all = this.conversations();
    return query ? all.filter((c) => c.title.toLocaleLowerCase().includes(query)) : all;
  });

  protected readonly groupLabels = computed<Record<ConversationGroupKey, string>>(() => ({
    today: this.todayLabel(),
    yesterday: this.yesterdayLabel(),
    last7: this.last7Label(),
    older: this.olderLabel(),
  }));

  protected readonly groups = computed<ConversationGroup[]>(() => {
    const now = new Date();
    const buckets: Record<ConversationGroupKey, Conversation[]> = {
      today: [],
      yesterday: [],
      last7: [],
      older: [],
    };
    for (const c of this.visible()) {
      buckets[bucketFor(c.updatedAt, now)].push(c);
    }
    const result: ConversationGroup[] = [];
    for (const key of GROUP_ORDER) {
      if (buckets[key].length > 0) {
        result.push({ key, label: this.groupLabels()[key], items: buckets[key] });
      }
    }
    return result;
  });
}
