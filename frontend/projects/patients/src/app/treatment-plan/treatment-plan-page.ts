import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideDownload,
  lucideLock,
  lucidePencil,
  lucideRotateCcw,
  lucideTrash2,
  lucideX,
} from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmBadge } from '@ui/badge';
import { HlmButton } from '@ui/button';
import { HlmDialog, HlmDialogContent, HlmDialogFooter, HlmDialogHeader, HlmDialogPortal, HlmDialogTitle } from '@ui/dialog';
import { HlmInput } from '@ui/input';
import { HlmLabel } from '@ui/label';
import {
  QuotesApi,
  TREATMENT_PLAN_ITEM_STATUSES,
  mapApiError,
  type Quote,
  type QuoteImportPreview,
  type QuoteImportPreviewItem,
  type TreatmentPlanItem,
  type TreatmentPlanItemStatus,
} from 'data-access';
import { ClinicalRecordStore } from '../clinical-record.store';
import { RichTextEditor } from '../rich-text/rich-text-editor';

/**
 * Treatment plan of the ficha. Items are imported from approved quotations
 * (never added by hand), their state is advanced (pendiente → realizado /
 * cancelado), they can be soft-deleted with a reason and restored from the
 * trash, and both the plan and each item carry a rich-text note.
 */
@Component({
  selector: 'app-treatment-plan-page',
  imports: [
    TranslocoPipe,
    NgIcon,
    HlmBadge,
    HlmButton,
    HlmInput,
    HlmLabel,
    HlmDialog,
    HlmDialogContent,
    HlmDialogPortal,
    HlmDialogHeader,
    HlmDialogTitle,
    HlmDialogFooter,
    RichTextEditor,
  ],
  providers: [
    provideIcons({
      lucideCheck,
      lucideDownload,
      lucideLock,
      lucidePencil,
      lucideRotateCcw,
      lucideTrash2,
      lucideX,
    }),
  ],
  templateUrl: './treatment-plan-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TreatmentPlanPage {
  private readonly transloco = inject(TranslocoService);
  private readonly store = inject(ClinicalRecordStore);
  private readonly quotesApi = inject(QuotesApi);

  protected readonly plan = this.store.plan;
  protected readonly trash = this.store.planTrash;
  protected readonly statuses = TREATMENT_PLAN_ITEM_STATUSES;
  protected readonly finalized = computed(() => this.store.record()?.status === 'finalizada');

  // Import dialog.
  protected readonly importOpen = signal(false);
  protected readonly approvedQuotes = signal<readonly Quote[] | null>(null);
  protected readonly selectedQuoteId = signal('');
  protected readonly preview = signal<QuoteImportPreview | null>(null);
  protected readonly previewing = signal(false);
  protected readonly importing = signal(false);
  protected readonly selection = signal<ReadonlySet<string>>(new Set());

  // Delete dialog.
  protected readonly deleteOpen = signal(false);
  protected readonly deleteTarget = signal<TreatmentPlanItem | null>(null);
  protected readonly deleteReason = signal('');
  protected readonly deleting = signal(false);

  // Trash.
  protected readonly showTrash = signal(false);
  protected readonly restoring = signal<string | null>(null);

  // Notes.
  protected readonly planNotesEditing = signal(false);
  protected readonly planNotesDraft = signal('');
  protected readonly savingPlanNotes = signal(false);
  protected readonly itemNotesEditing = signal<string | null>(null);
  protected readonly itemNotesDraft = signal('');
  protected readonly savingItemNotes = signal(false);

  protected items(): TreatmentPlanItem[] {
    return this.plan()?.items ?? [];
  }

  protected trashItems(): TreatmentPlanItem[] {
    return this.trash()?.items ?? [];
  }

  protected toothLabel(tooth: number | null): string {
    return tooth === null ? '—' : String(tooth);
  }

  protected statusLabelKey(status: string): string {
    return `clinical.plan.statuses.${status}`;
  }

  protected statusVariant(status: string): 'outline' | 'secondary' | 'destructive' {
    switch (status) {
      case 'realizado':
        return 'secondary';
      case 'cancelado':
        return 'destructive';
      default:
        return 'outline';
    }
  }

  protected flagLabelKey(flag: QuoteImportPreviewItem['flag']): string {
    return `clinical.plan.import.flags.${flag}`;
  }

  protected readStatus(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  protected readChecked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  protected changeStatus(item: TreatmentPlanItem, status: string): void {
    if (status === item.status) {
      return;
    }

    this.store.updatePlanItem(item.id, { status: status as TreatmentPlanItemStatus }).subscribe({
      error: (error: unknown) => toast.error(this.transloco.translate(mapApiError(error))),
    });
  }

  // --- Import -----------------------------------------------------------------

  protected openImport(): void {
    this.importOpen.set(true);
    this.selectedQuoteId.set('');
    this.preview.set(null);
    this.selection.set(new Set());

    this.quotesApi
      .list({ patientId: this.store.patientId(), status: 'aprobada' })
      .subscribe({
        next: (quotes) => this.approvedQuotes.set(quotes),
        error: () => this.approvedQuotes.set([]),
      });
  }

  protected onImportStateChanged(state: 'open' | 'closed'): void {
    if (state === 'closed') {
      this.importOpen.set(false);
    }
  }

  protected readQuoteId(event: Event): void {
    const quoteId = (event.target as HTMLSelectElement).value;
    this.selectedQuoteId.set(quoteId);
    this.preview.set(null);
    this.selection.set(new Set());

    if (quoteId === '') {
      return;
    }

    this.previewing.set(true);

    this.store.previewQuoteImport(quoteId).subscribe({
      next: (preview) => {
        this.preview.set(preview);
        this.selection.set(
          new Set(
            preview.items
              .filter((item) => item.flag !== 'duplicado' && item.flag !== 'ambiguo')
              .map((item) => item.quoteItemId),
          ),
        );
        this.previewing.set(false);
      },
      error: (error: unknown) => {
        this.previewing.set(false);
        toast.error(this.transloco.translate(mapApiError(error)));
      },
    });
  }

  protected isSelected(quoteItemId: string): boolean {
    return this.selection().has(quoteItemId);
  }

  protected toggleSelection(quoteItemId: string, checked: boolean): void {
    const next = new Set(this.selection());

    if (checked) {
      next.add(quoteItemId);
    } else {
      next.delete(quoteItemId);
    }

    this.selection.set(next);
  }

  protected confirmImport(): void {
    const quoteId = this.selectedQuoteId();

    if (quoteId === '') {
      return;
    }

    this.importing.set(true);

    this.store
      .importQuote({ quoteId, itemIds: [...this.selection()] })
      .subscribe({
        next: (items) => {
          this.importing.set(false);
          this.importOpen.set(false);
          toast.success(
            this.transloco.translate('clinical.plan.toasts.imported', { count: items.length }),
          );
        },
        error: (error: unknown) => {
          this.importing.set(false);
          toast.error(this.transloco.translate(mapApiError(error)));
        },
      });
  }

  // --- Delete / trash ---------------------------------------------------------

  protected openDelete(item: TreatmentPlanItem): void {
    this.deleteTarget.set(item);
    this.deleteReason.set('');
    this.deleteOpen.set(true);
  }

  protected onDeleteStateChanged(state: 'open' | 'closed'): void {
    if (state === 'closed') {
      this.deleteOpen.set(false);
    }
  }

  protected readReason(event: Event): void {
    this.deleteReason.set((event.target as HTMLInputElement).value);
  }

  protected confirmDelete(): void {
    const item = this.deleteTarget();
    const reason = this.deleteReason().trim();

    if (item === null || reason === '') {
      return;
    }

    this.deleting.set(true);

    this.store.deletePlanItem(item.id, reason).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteOpen.set(false);
        toast.success(this.transloco.translate('clinical.plan.toasts.itemDeleted'));
      },
      error: (error: unknown) => {
        this.deleting.set(false);
        toast.error(this.transloco.translate(mapApiError(error)));
      },
    });
  }

  protected toggleTrash(): void {
    this.showTrash.update((value) => !value);

    if (this.showTrash()) {
      this.store.reloadTrash();
    }
  }

  protected restore(item: TreatmentPlanItem): void {
    this.restoring.set(item.id);

    this.store.restorePlanItem(item.id).subscribe({
      next: () => {
        this.restoring.set(null);
        toast.success(this.transloco.translate('clinical.plan.toasts.itemRestored'));
      },
      error: (error: unknown) => {
        this.restoring.set(null);
        toast.error(this.transloco.translate(mapApiError(error)));
      },
    });
  }

  // --- Notes ------------------------------------------------------------------

  protected startPlanNotes(): void {
    this.planNotesDraft.set(this.plan()?.notes ?? '');
    this.planNotesEditing.set(true);
  }

  protected cancelPlanNotes(): void {
    this.planNotesEditing.set(false);
  }

  protected onPlanNotesChange(html: string): void {
    this.planNotesDraft.set(html);
  }

  protected savePlanNotes(): void {
    this.savingPlanNotes.set(true);

    this.store.updatePlanNotes(this.planNotesDraft()).subscribe({
      next: () => {
        this.savingPlanNotes.set(false);
        this.planNotesEditing.set(false);
        toast.success(this.transloco.translate('clinical.plan.toasts.notesSaved'));
      },
      error: (error: unknown) => {
        this.savingPlanNotes.set(false);
        toast.error(this.transloco.translate(mapApiError(error)));
      },
    });
  }

  protected startItemNotes(item: TreatmentPlanItem): void {
    this.itemNotesDraft.set(item.notes ?? '');
    this.itemNotesEditing.set(item.id);
  }

  protected cancelItemNotes(): void {
    this.itemNotesEditing.set(null);
  }

  protected onItemNotesChange(html: string): void {
    this.itemNotesDraft.set(html);
  }

  protected saveItemNotes(item: TreatmentPlanItem): void {
    this.savingItemNotes.set(true);

    this.store.updatePlanItem(item.id, { notes: this.itemNotesDraft() }).subscribe({
      next: () => {
        this.savingItemNotes.set(false);
        this.itemNotesEditing.set(null);
        toast.success(this.transloco.translate('clinical.plan.toasts.notesSaved'));
      },
      error: (error: unknown) => {
        this.savingItemNotes.set(false);
        toast.error(this.transloco.translate(mapApiError(error)));
      },
    });
  }
}
