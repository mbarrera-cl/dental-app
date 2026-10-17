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
  lucideCheck,
  lucideDatabase,
  lucideFileText,
  lucideMenu,
  lucideMessageSquare,
  lucidePencil,
  lucidePlus,
  lucideSearch,
  lucideSparkles,
  lucideTable,
  lucideTrash2,
  lucideTriangleAlert,
  lucideX,
} from '@ng-icons/lucide';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { HlmBadge } from '@ui/badge';
import { HlmButton } from '@ui/button';
import { HlmInput } from '@ui/input';
import { HlmSpinner } from '@ui/spinner';
import {
  PkChatContainerContent,
  PkChatContainerRoot,
  PkChatContainerScrollAnchor,
} from '@ui/prompt-kit/chat-container';
import { PkAssistantTurn, PkUserTurn } from '@ui/prompt-kit/chat-turn';
import {
  PkConversationList,
  type Conversation,
  type ConversationRename,
} from '@ui/prompt-kit/conversation-list';
import { PkComposer } from '@ui/prompt-kit/composer';
import { PkMarkdown } from '@ui/prompt-kit/markdown';
import { PkApproval } from '@ui/prompt-kit/approval';
import { PkPromptSuggestion } from '@ui/prompt-kit/prompt-suggestion';
import { formatRelativeTime } from 'ui';
import type { CaroAttachment, CaroConversation, CaroPendingApproval } from 'data-access';
import { CaroAudioRecorder } from './caro-audio-recorder';
import { CaroIaStore } from './caro-ia.store';

type CaroIaView = 'chat' | 'table';

/**
 * Página CaroIA (rama UI): chat estilo Gemini/DeepSeek con `ngx-prompt-kit`,
 * conversaciones simuladas, adjuntos, audio y aprobaciones. La rama backend
 * sustituye el gateway simulado por HTTP/SSE sin tocar esta página.
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
    PkConversationList,
    PkChatContainerRoot,
    PkChatContainerContent,
    PkChatContainerScrollAnchor,
    PkAssistantTurn,
    PkUserTurn,
    PkComposer,
    PkMarkdown,
    PkPromptSuggestion,
    PkApproval,
    CaroAudioRecorder,
  ],
  providers: [
    provideIcons({
      lucideCheck,
          lucideDatabase,
      lucideFileText,
      lucideMenu,
      lucideMessageSquare,
      lucidePencil,
      lucidePlus,
      lucideSearch,
      lucideSparkles,
      lucideTable,
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

  protected readonly view = signal<CaroIaView>('chat');
  protected readonly sidebarOpen = signal(false);
  protected readonly composerValue = signal('');
  protected readonly search = signal('');
  protected readonly audioError = signal<string | null>(null);
  protected readonly composer = viewChild(PkComposer);
  protected readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly conversationItems = computed<Conversation[]>(() =>
    this.store.conversations().map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      preview: conversation.preview ?? '',
      updatedAt: conversation.updatedAt,
    })),
  );

  protected readonly filteredConversations = computed<CaroConversation[]>(() => {
    const query = this.search().trim().toLowerCase();

    return query === ''
      ? this.store.conversations()
      : this.store.conversations().filter((conversation) =>
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

  protected readonly groupLabels = computed(() => {
    this.language();

    return {
      today: this.t('caroIa.groups.today'),
      yesterday: this.t('caroIa.groups.yesterday'),
      last7: this.t('caroIa.groups.last7'),
      older: this.t('caroIa.groups.older'),
    };
  });

  ngOnInit(): void {
    this.store.loadConversations();
  }

  protected newConversation(): void {
    this.store.create();
    this.view.set('chat');
    this.sidebarOpen.set(false);
    queueMicrotask(() => this.composer()?.focus());
  }

  protected selectConversation(id: string): void {
    this.store.open(id);
    this.view.set('chat');
    this.sidebarOpen.set(false);
  }

  protected rename(event: ConversationRename): void {
    this.store.rename(event.id, event.title);
  }

  protected remove(id: string): void {
    if (!window.confirm(this.t('caroIa.table.deleteConfirm'))) {
      return;
    }

    this.store.remove(id);
  }

  protected onSubmit(content: string): void {
    const attachmentIds = this.store.readyAttachments().map((attachment) => attachment.id);

    this.store.send(content, attachmentIds);
    this.composerValue.set('');
  }

  protected useSuggestion(content: string): void {
    this.onSubmit(content);
  }

  protected onFiles(files: File[]): void {
    files.forEach((file) => this.store.upload(file));
  }

  protected onAudio(blob: Blob): void {
    this.audioError.set(null);
    const file = new File([blob], 'audio.webm', { type: blob.type || 'audio/webm' });

    this.store.upload(file);
    this.store.transcribe(blob).subscribe({
      next: (transcription) => {
        this.composerValue.update((value) =>
          value.trim() === '' ? transcription.text : `${value} ${transcription.text}`,
        );
      },
      error: () => this.audioError.set(this.t('caroIa.audio.error')),
    });
  }

  protected toggleView(view: CaroIaView): void {
    this.view.set(view);
    this.sidebarOpen.set(false);
  }

  protected openSidebar(): void {
    this.sidebarOpen.set(true);
  }

  protected closeSidebar(): void {
    this.sidebarOpen.set(false);
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

  protected formatSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(0)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  protected approvalParameters(approval: CaroPendingApproval) {
    return approval.parameters;
  }

  protected approvalStatusLabel(approval: CaroPendingApproval): string {
    return this.t(`caroIa.approval.status.${approval.status}`);
  }

  protected isAudio(attachment: CaroAttachment): boolean {
    return attachment.kind === 'audio';
  }

  protected t(key: string): string {
    return this.transloco.translate(key);
  }
}
