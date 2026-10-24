import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideCheck,
  lucideDatabase,
  lucideFileText,
  lucideMessageSquare,
  lucidePencil,
  lucidePlus,
  lucideSearch,
  lucideSparkles,
  lucideTrash2,
  lucideTriangleAlert,
  lucideX,
} from '@ng-icons/lucide';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { HlmBadge } from '@ui/badge';
import { HlmButton } from '@ui/button';
import { BarChart } from '@ui/chart';
import { HlmInput } from '@ui/input';
import { HlmSpinner } from '@ui/spinner';
import {
  PkChatContainerContent,
  PkChatContainerRoot,
  PkChatContainerScrollAnchor,
} from '@ui/prompt-kit/chat-container';
import { PkAssistantTurn, PkUserTurn } from '@ui/prompt-kit/chat-turn';
import { PkComposer } from '@ui/prompt-kit/composer';
import { PkMarkdown } from '@ui/prompt-kit/markdown';
import { PkApproval } from '@ui/prompt-kit/approval';
import { PkPromptSuggestion } from '@ui/prompt-kit/prompt-suggestion';
import { PkThinking } from '@ui/prompt-kit/thinking';
import { formatRelativeTime } from 'ui';
import type { CaroConversation, CaroPendingApproval } from 'data-access';
import { CaroAudioRecorder } from './caro-audio-recorder';
import { CaroIaStore } from './caro-ia.store';

type CaroIaView = 'chat' | 'table';

/**
 * Página CaroIA (rama UI). La vista inicial es la tabla de conversaciones; el
 * chat se abre al seleccionar una fila o crear una conversación. Sin cabecera
 * propia: la tabla/chat ocupan el alto completo del shell y scrollean dentro.
 */
@Component({
  selector: 'app-caro-ia-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    HlmBadge,
    HlmButton,
    HlmInput,
    HlmSpinner,
    BarChart,
    PkChatContainerRoot,
    PkChatContainerContent,
    PkChatContainerScrollAnchor,
    PkAssistantTurn,
    PkUserTurn,
    PkComposer,
    PkMarkdown,
    PkPromptSuggestion,
    PkApproval,
    PkThinking,
    CaroAudioRecorder,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideCheck,
      lucideDatabase,
      lucideFileText,
      lucideMessageSquare,
      lucidePencil,
      lucidePlus,
      lucideSearch,
      lucideSparkles,
      lucideTrash2,
      lucideTriangleAlert,
      lucideX,
    }),
  ],
  templateUrl: './caro-ia-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaroIaPage implements OnInit {
  private readonly transloco = inject(TranslocoService);
  protected readonly store = inject(CaroIaStore);

  protected readonly view = signal<CaroIaView>('table');
  protected readonly composerValue = signal('');
  protected readonly search = signal('');
  protected readonly audioError = signal<string | null>(null);
  protected readonly composer = viewChild(PkComposer);
  protected readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly filteredConversations = computed<CaroConversation[]>(() => {
    const query = this.search().trim().toLowerCase();

    return query === ''
      ? this.store.conversations()
      : this.store
          .conversations()
          .filter((conversation) =>
            `${conversation.title} ${conversation.preview ?? ''}`.toLowerCase().includes(query),
          );
  });

  protected readonly suggestions = computed(() => {
    this.language();

    return [
      this.t('caroIa.suggestions.lastQuote'),
      this.t('caroIa.suggestions.pending'),
      this.t('caroIa.suggestions.patient'),
      this.t('caroIa.suggestions.uco'),
    ];
  });

  ngOnInit(): void {
    this.store.loadConversations();
  }

  protected newConversation(): void {
    this.store.startDraft();
    this.view.set('chat');
    queueMicrotask(() => this.composer()?.focus());
  }

  protected selectConversation(id: string): void {
    this.store.open(id);
    this.view.set('chat');
  }

  protected backToConversations(): void {
    this.store.stop();
    this.view.set('table');
    this.store.dismissError();
  }

  protected onSubmit(content: string): void {
    this.store.send(content);
    this.composerValue.set('');
  }

  protected useSuggestion(content: string): void {
    this.onSubmit(content);
  }

  protected onAudio(blob: Blob): void {
    this.audioError.set(null);

    this.store.transcribe(blob).subscribe({
      next: (transcription) => {
        this.composerValue.update((value) =>
          value.trim() === '' ? transcription.text : `${value} ${transcription.text}`,
        );
      },
      error: () => this.audioError.set(this.t('caroIa.audio.error')),
    });
  }

  protected setSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected tableRename(conversation: CaroConversation): void {
    const title = window.prompt(this.t('caroIa.table.renamePrompt'), conversation.title);

    if (title !== null && title.trim() !== '') {
      this.store.rename(conversation.id, title.trim());
    }
  }

  protected tableDelete(conversation: CaroConversation): void {
    if (window.confirm(this.t('caroIa.table.deleteConfirm'))) {
      this.store.remove(conversation.id);
    }
  }

  protected relative(iso: string): string {
    return formatRelativeTime(iso, this.language());
  }

  protected approvalParameters(approval: CaroPendingApproval) {
    return approval.parameters;
  }

  protected approvalStatusLabel(approval: CaroPendingApproval): string {
    return this.t(`caroIa.approval.status.${approval.status}`);
  }

  protected t(key: string): string {
    return this.transloco.translate(key);
  }
}
