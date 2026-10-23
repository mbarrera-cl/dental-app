import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideFileText,
  lucidePlus,
  lucideSearch,
  lucideTrash2,
  lucideTriangleAlert,
  lucideUndo2,
  lucideX,
} from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmBadge } from '@ui/badge';
import { HlmButton } from '@ui/button';
import { HlmInput } from '@ui/input';
import { HlmLabel } from '@ui/label';
import { HasPermissionDirective, PERMISSION_KEYS, SessionStore } from 'auth';
import {
  mapApiError,
  PatientsApi,
  QuotesApi,
  UcoApi,
  type Patient,
  type Quote,
  type QuoteItemStatus,
  type QuoteStatus,
  type UcoProcedure,
} from 'data-access';

interface DraftItem {
  id?: string;
  ucoCode: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
}

/**
 * Quote editor: pick a patient, add UCO-catalog or manual lines, watch the
 * totals live, decide item statuses and sanction. The server recomputes all
 * totals on save — the client never trusts its own math.
 */
@Component({
  selector: 'app-quote-editor',
  imports: [
    TranslocoPipe,
    NgIcon,
    HlmBadge,
    HlmButton,
    HlmInput,
    HlmLabel,
    HasPermissionDirective,
  ],
  providers: provideIcons({
      lucideCheck,
    lucideFileText,
    lucidePlus,
    lucideSearch,
    lucideTrash2,
    lucideTriangleAlert,
    lucideUndo2,
    lucideX,
  }),
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col gap-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="grid gap-1">
          <h2 class="text-2xl font-semibold tracking-tight">
            {{ (editing() ? 'quotes.edit.title' : 'quotes.new.title') | transloco }}
          </h2>
          <p class="text-muted-foreground text-sm">
            @if (quote(); as quote) {
              {{ quote.folio }}
            } @else {
              {{ 'quotes.new.subtitle' | transloco }}
            }
          </p>
          @if (editing()) {
            <div class="mt-2 flex flex-wrap items-center gap-2">
              <label class="text-muted-foreground text-sm" for="quote-status">{{ 'quotes.editor.status' | transloco }}</label>
              <select
                id="quote-status"
                hlmInput
                class="w-auto"
                data-testid="quote-status-select"
                [value]="quote()?.status ?? 'borrador'"
                [disabled]="!canChangeStatus()"
                (change)="changeStatus($any($event.target).value, $any($event.target))"
              >
                @for (status of statuses; track status) {
                  <option [value]="status" [disabled]="!canSetStatus(status)">
                    {{ 'quotes.status.' + status | transloco }}
                  </option>
                }
              </select>
            </div>
          }
        </div>
      </header>

      @if (loadError(); as errorKey) {
        <div class="border-destructive/30 bg-destructive/5 text-destructive flex items-center gap-3 rounded-lg border px-4 py-3 text-sm">
          <ng-icon name="lucideTriangleAlert" class="shrink-0" />
          <p class="flex-1">{{ errorKey | transloco }}</p>
        </div>
      }

      <!-- Patient picker (fixed when the quote starts from the patient profile) -->
      <div class="bg-card grid gap-4 rounded-lg border p-4">
        <div class="grid gap-2">
          <label hlmLabel>{{ 'quotes.editor.patient' | transloco }}</label>

          @if (patientLocked()) {
            <div
              class="border-input flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              data-testid="quote-patient-locked"
            >
              <span class="font-medium">
                {{ lockedPatientName() }} · {{ formatRut(lockedPatientRut() ?? '') }}
              </span>
              <span class="text-muted-foreground text-xs">{{ 'quotes.editor.patientLocked' | transloco }}</span>
            </div>
          } @else if (selectedPatientId() !== null && selectedPatientName() !== null) {
            <div
              class="border-input flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              data-testid="quote-patient-selected"
            >
              <span class="font-medium">
                {{ selectedPatientName() }} · {{ formatRut(selectedPatientRut() ?? '') }}
              </span>
              <button
                hlmBtn
                variant="ghost"
                size="sm"
                type="button"
                data-testid="quote-patient-change"
                (click)="changePatient()"
              >
                {{ 'quotes.editor.changePatient' | transloco }}
              </button>
            </div>
          } @else {
            <input
              hlmInput
              [value]="patientQuery()"
              (input)="patientQuery.set($any($event.target).value)"
              placeholder="{{ 'quotes.editor.searchPatient' | transloco }}"
              data-testid="quote-patient-search"
            />
            <div class="flex flex-wrap gap-2">
              @for (patient of patientMatches(); track patient.id) {
                <button
                  hlmBtn
                  variant="outline"
                  size="sm"
                  type="button"
                  class="justify-start"
                  (click)="selectPatient(patient)"
                >
                  {{ patient.nombres }} {{ patient.apellidoPaterno }} · {{ formatRut(patient.rut) }}
                </button>
              }
            </div>
          }
        </div>
      </div>

      <!-- Items -->
      <div class="bg-card rounded-lg border">
        <div class="flex items-center justify-between gap-2 border-b px-4 py-3">
          <h3 class="font-semibold">{{ 'quotes.editor.items' | transloco }}</h3>
          <div class="flex flex-wrap items-center gap-2">
            <button
              hlmBtn
              variant="outline"
              size="sm"
              type="button"
              data-testid="quote-item-manual"
              (click)="addManualItem()"
            >
              <ng-icon name="lucidePlus" />
              {{ 'quotes.editor.addManual' | transloco }}
            </button>
            <div class="relative">
              <ng-icon name="lucideSearch" class="text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2" />
              <input
                hlmInput
                class="ps-9"
                [value]="ucoQuery()"
                (input)="ucoQuery.set($any($event.target).value)"
                placeholder="{{ 'quotes.editor.searchUco' | transloco }}"
                data-testid="quote-uco-search"
              />
            </div>
          </div>
        </div>

        <div class="grid gap-2 p-4">
          @if (ucoMatches().length > 0) {
            <div class="flex flex-wrap gap-2">
              @for (procedure of ucoMatches(); track procedure.code) {
                <button
                  hlmBtn
                  variant="outline"
                  size="sm"
                  type="button"
                  (click)="addProcedure(procedure)"
                >
                  <ng-icon name="lucidePlus" />
                  {{ procedure.code }} · {{ procedure.name }}
                </button>
              }
            </div>
          }

          @for (item of items(); track itemIndex($index)) {
            <div class="border-input grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_80px_110px_90px_90px_auto]">
              <div class="grid gap-1">
                <span class="text-muted-foreground text-xs">{{ 'quotes.editor.description' | transloco }}</span>
                <input
                  hlmInput
                  [value]="item.description"
                  (input)="setDescription($index, $any($event.target).value)"
                      data-testid="quote-item-desc"
                />
              </div>
              <div class="grid gap-1">
                <span class="text-muted-foreground text-xs">{{ 'quotes.editor.qty' | transloco }}</span>
                <input
                  hlmInput
                  type="number"
                  min="1"
                  [value]="item.quantity"
                  (input)="setQuantity($index, $any($event.target).valueAsNumber)"
                    />
              </div>
              <div class="grid gap-1">
                <span class="text-muted-foreground text-xs">{{ 'quotes.editor.unitPrice' | transloco }}</span>
                <input
                  hlmInput
                  type="number"
                  min="0"
                  [value]="item.unitPrice"
                  (input)="setUnitPrice($index, $any($event.target).valueAsNumber)"
                    />
              </div>
              <div class="grid gap-1">
                <span class="text-muted-foreground text-xs">{{ 'quotes.editor.discount' | transloco }}</span>
                <input
                  hlmInput
                  type="number"
                  min="0"
                  max="100"
                  [value]="item.discountPercent"
                  (input)="setDiscount($index, $any($event.target).valueAsNumber)"
                    />
              </div>
              <div class="grid items-end gap-1">
                <span class="text-muted-foreground text-xs">{{ 'quotes.editor.net' | transloco }}</span>
                <span class="font-medium tabular-nums">{{ formatMoney(netOf(item)) }}</span>
              </div>
              <div class="flex items-end justify-end gap-1">
                @if (item.id) {
                  <span hlmBadge [variant]="itemStatusVariant(item.id)">
                    {{ 'quotes.itemStatus.' + itemStatusOf(item.id) | transloco }}
                  </span>
                }
                @if (item.id) {
                  <button
                    *hasPermission="permissionKeys.quotes.update"
                    hlmBtn
                    variant="ghost"
                    size="icon-sm"
                    type="button"
                    [attr.aria-label]="'quotes.decide.approve' | transloco"
                    [attr.data-testid]="'quote-item-approve-' + item.id"
                    (click)="decideItem(item.id, 'aprobado')"
                  >
                    <ng-icon name="lucideCheck" />
                  </button>
                  <button
                    *hasPermission="permissionKeys.quotes.update"
                    hlmBtn
                    variant="ghost"
                    size="icon-sm"
                    type="button"
                    class="text-destructive"
                    [attr.aria-label]="'quotes.decide.reject' | transloco"
                    [attr.data-testid]="'quote-item-reject-' + item.id"
                    (click)="decideItem(item.id, 'rechazado')"
                  >
                    <ng-icon name="lucideX" />
                  </button>
                  @if (itemStatusOf(item.id) !== 'generado') {
                    <button
                      *hasPermission="permissionKeys.quotes.update"
                      hlmBtn
                      variant="ghost"
                      size="icon-sm"
                      type="button"
                      [attr.aria-label]="'quotes.decide.reopen' | transloco"
                      [attr.data-testid]="'quote-item-reopen-' + item.id"
                      (click)="decideItem(item.id, 'generado')"
                    >
                      <ng-icon name="lucideUndo2" />
                    </button>
                  }
                }
                <button
                  hlmBtn
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                      (click)="removeItem($index)"
                >
                  <ng-icon name="lucideTrash2" />
                </button>
              </div>
            </div>
          }

          @if (items().length === 0) {
            <p class="text-muted-foreground text-sm">{{ 'quotes.editor.noItems' | transloco }}</p>
          }
        </div>
      </div>

      <!-- Totals -->
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="bg-card rounded-lg border p-4">
          <dl class="grid gap-1 text-sm">
            <div class="flex justify-between gap-8"><dt class="text-muted-foreground">{{ 'quotes.totals.subtotal' | transloco }}</dt><dd class="tabular-nums">{{ formatMoney(subtotal()) }}</dd></div>
            <div class="flex justify-between gap-8"><dt class="text-muted-foreground">{{ 'quotes.totals.discount' | transloco }}</dt><dd class="tabular-nums">− {{ formatMoney(discountTotal()) }}</dd></div>
            <div class="flex justify-between gap-8 border-t pt-1"><dt class="font-medium">{{ 'quotes.totals.total' | transloco }}</dt><dd class="font-semibold tabular-nums">{{ formatMoney(total()) }}</dd></div>
            @if (approvedTotal() > 0) {
              <div class="flex justify-between gap-8"><dt class="text-muted-foreground">{{ 'quotes.totals.approved' | transloco }}</dt><dd class="tabular-nums">{{ formatMoney(approvedTotal()) }}</dd></div>
            }
          </dl>
        </div>

        <div class="flex flex-wrap gap-2">
          <button *hasPermission="permissionKeys.quotes.update" hlmBtn type="button" (click)="create()" [disabled]="!canCreate()" data-testid="quote-save">
            <ng-icon name="lucideCheck" />
            {{ editing() ? ('quotes.editor.saveChanges' | transloco) : ('quotes.new.saveDraft' | transloco) }}
          </button>
        </div>
      </div>
    </section>
  `,
})
export class QuoteEditor {
  private readonly api = inject(QuotesApi);
  private readonly patientsApi = inject(PatientsApi);
  private readonly ucoApi = inject(UcoApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly session = inject(SessionStore);

  protected readonly permissionKeys = PERMISSION_KEYS;
  protected readonly statuses: readonly QuoteStatus[] = [
    'borrador',
    'sin_respuesta',
    'aprobada',
    'rechazada',
  ];
  protected readonly canUpdate = computed(() => this.session.has(PERMISSION_KEYS.quotes.update));
  protected readonly canApprove = computed(() => this.session.has(PERMISSION_KEYS.quotes.approve));
  protected readonly canChangeStatus = computed(() => this.canUpdate() || this.canApprove());

  protected readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly quote = signal<Quote | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly patientQuery = signal('');
  protected readonly patients = signal<Patient[]>([]);
  protected readonly selectedPatientId = signal<string | null>(null);
  protected readonly selectedPatientName = signal<string | null>(null);
  protected readonly selectedPatientRut = signal<string | null>(null);
  /** Patient fixed by the URL context or by the quote being edited. */
  protected readonly lockedPatientName = signal<string | null>(null);
  protected readonly lockedPatientRut = signal<string | null>(null);
  protected readonly patientLocked = computed(() => this.lockedPatientName() !== null);

  protected readonly ucoQuery = signal('');
  protected readonly procedures = signal<UcoProcedure[]>([]);

  protected readonly items = signal<DraftItem[]>([]);

  protected readonly patientMatches = computed(() => {
    const needle = this.patientQuery().toLowerCase();

    return needle.length === 0
      ? []
      : this.patients().filter((patient) =>
          `${patient.nombres} ${patient.apellidoPaterno} ${patient.apellidoMaterno} ${patient.rut}`
            .toLowerCase()
            .includes(needle),
        );
  });

  protected readonly ucoMatches = computed(() => {
    const needle = this.ucoQuery().trim().toLowerCase();

    // Predictive search: only after a couple of characters, capped to keep
    // the picker readable (49 seeded procedures would flood the editor).
    if (needle.length < 2) {
      return [];
    }

    return this.procedures()
      .filter(
        (procedure) =>
          procedure.code.toLowerCase().includes(needle) ||
          procedure.name.toLowerCase().includes(needle),
      )
      .slice(0, 12);
  });

  protected readonly subtotal = computed(() => this.items().reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
  protected readonly discountTotal = computed(() =>
    this.items().reduce((sum, item) => sum + Math.round((item.quantity * item.unitPrice * item.discountPercent) / 100), 0),
  );
  protected readonly total = computed(() => this.subtotal() - this.discountTotal());
  protected readonly approvedTotal = computed(() => {
    const quote = this.quote();

    return quote === null
      ? 0
      : quote.items
          .filter((item) => item.status === 'aprobado')
          .reduce((sum, item) => sum + item.netAmount, 0);
  });

  protected readonly editing = computed(() => this.quote() !== null);

  protected readonly canCreate = computed(() => this.selectedPatientId() !== null && this.items().length > 0);

  constructor() {
    this.load();
    this.patientsApi.list().subscribe({ next: (patients) => this.patients.set(patients) });
    this.ucoApi.list().subscribe({ next: (procedures) => this.procedures.set(procedures) });
    this.lockPatientFromQuery();
  }

  /**
   * The patient profile opens `/quotes/new?patientId=…`: the patient is fixed
   * so a budget created from a record cannot land on another patient.
   */
  private lockPatientFromQuery(): void {
    const patientId = this.route.snapshot.queryParamMap.get('patientId');

    if (patientId === null || patientId === '') {
      return;
    }

    this.selectedPatientId.set(patientId);

    this.patientsApi.getById(patientId).subscribe({
      next: (patient) => {
        this.lockedPatientName.set(this.patientLabel(patient));
        this.lockedPatientRut.set(patient.rut);
        this.selectedPatientName.set(this.patientLabel(patient));
        this.selectedPatientRut.set(patient.rut);
      },
      // The id is still usable; the API validates the patient on save.
      error: () => undefined,
    });
  }

  protected load(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (id === null) {
      this.loading.set(false);
      return;
    }

    this.api.getById(id).subscribe({
      next: (quote) => {
        this.quote.set(quote);
        this.selectedPatientId.set(quote.patientId);
        this.selectedPatientName.set(quote.patientName);
        this.selectedPatientRut.set(quote.patientRut);
        // An existing quote belongs to its patient: the patient never changes.
        this.lockedPatientName.set(quote.patientName);
        this.lockedPatientRut.set(quote.patientRut);
        this.items.set(
          quote.items.map((item) => ({
            id: item.id,
            ucoCode: item.ucoCode,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountPercent: item.discountPercent,
          })),
        );
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(mapApiError(error));
        this.loading.set(false);
      },
    });
  }

  protected selectPatient(patient: Patient): void {
    this.selectedPatientId.set(patient.id);
    this.selectedPatientName.set(this.patientLabel(patient));
    this.selectedPatientRut.set(patient.rut);
    this.patientQuery.set('');
  }

  private patientLabel(patient: Patient): string {
    return `${patient.nombres} ${patient.apellidoPaterno} ${patient.apellidoMaterno}`.trim();
  }

  /** Clears the current selection so the search field is shown again. */
  protected changePatient(): void {
    this.selectedPatientId.set(null);
    this.selectedPatientName.set(null);
    this.selectedPatientRut.set(null);
    this.patientQuery.set('');
  }

  protected addProcedure(procedure: UcoProcedure): void {
    this.items.update((items) => [
      ...items,
      {
        ucoCode: procedure.code,
        description: procedure.name,
        quantity: 1,
        unitPrice: Math.round(procedure.units * 3000),
        discountPercent: 0,
      },
    ]);
  }

  /** Manual line: free description, no UCO code (still priced/recalculated server-side). */
  protected addManualItem(): void {
    this.items.update((items) => [
      ...items,
      { ucoCode: null, description: '', quantity: 1, unitPrice: 0, discountPercent: 0 },
    ]);
  }

  protected setDescription(index: number, value: string): void {
    this.items.update((items) => items.map((item, i) => (i === index ? { ...item, description: value } : item)));
  }

  protected setQuantity(index: number, value: number): void {
    this.items.update((items) => items.map((item, i) => (i === index ? { ...item, quantity: value } : item)));
  }

  protected setUnitPrice(index: number, value: number): void {
    this.items.update((items) => items.map((item, i) => (i === index ? { ...item, unitPrice: value } : item)));
  }

  protected setDiscount(index: number, value: number): void {
    this.items.update((items) => items.map((item, i) => (i === index ? { ...item, discountPercent: value } : item)));
  }

  protected removeItem(index: number): void {
    this.items.update((items) => items.filter((_, i) => i !== index));
  }

  protected netOf(item: DraftItem): number {
    return Math.round((item.quantity * item.unitPrice * (100 - item.discountPercent)) / 100);
  }

  protected itemIndex(index: number): number {
    return index;
  }

  protected formatMoney(value: number): string {
    return new Intl.NumberFormat(this.language() === 'en' ? 'en-US' : 'es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(value);
  }

  protected formatRut(rut: string): string {
    return rut;
  }

  protected create(): void {
    const payload = {
      patientId: this.selectedPatientId()!,
      items: this.items().map((item) => ({
        id: item.id,
        ucoCode: item.ucoCode,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: item.discountPercent,
      })),
    };

    if (this.editing()) {
      void this.api.update(this.quote()!.id, { items: payload.items }).subscribe({
        next: (updated) => {
          this.quote.set(updated);
          toast.success(this.transloco.translate('quotes.saved'));
          void this.router.navigate(['/quotes', updated.id]);
        },
        error: (error: unknown) => toast.error(mapApiError(error)),
      });
      return;
    }

    void this.api.create(payload).subscribe({
      next: (created) => {
        toast.success(this.transloco.translate('quotes.created', { folio: created.folio }));
        void this.router.navigate(['/quotes', created.id]);
      },
      error: (error: unknown) => toast.error(mapApiError(error)),
    });
  }

  protected canSetStatus(status: QuoteStatus): boolean {
    return status === 'aprobada' || status === 'rechazada'
      ? this.canApprove()
      : this.canUpdate();
  }

  protected itemStatusOf(itemId: string): QuoteItemStatus {
    return this.quote()?.items.find((item) => item.id === itemId)?.status ?? 'generado';
  }

  protected itemStatusVariant(itemId: string): 'secondary' | 'outline' | 'destructive' {
    const status = this.itemStatusOf(itemId);

    return status === 'aprobado' ? 'secondary' : status === 'rechazado' ? 'destructive' : 'outline';
  }

  /** Records the patient's acceptance for one line (server-audited). */
  protected decideItem(itemId: string, status: QuoteItemStatus): void {
    const quote = this.quote();

    if (quote === null) {
      return;
    }

    this.api.decideItem(quote.id, itemId, status).subscribe({
      next: (updated) => {
        this.quote.set(updated);
        toast.success(this.transloco.translate('quotes.decide.saved'));
      },
      error: (error: unknown) => toast.error(mapApiError(error)),
    });
  }

  protected changeStatus(status: QuoteStatus, select?: HTMLSelectElement): void {
    const quote = this.quote();

    if (quote === null || quote.status === status) {
      return;
    }

    const reset = (): void => {
      if (select !== undefined) {
        select.value = quote.status;
      }
    };
    const key = status === 'aprobada'
      ? 'quotes.sanctionApproveConfirm'
      : status === 'rechazada'
        ? 'quotes.sanctionRejectConfirm'
        : null;

    if (key !== null && !window.confirm(this.transloco.translate(key, { folio: quote.folio }))) {
      reset();
      return;
    }

    this.api.setStatus(quote.id, status).subscribe({
      next: (updated) => {
        this.quote.set(updated);
        toast.success(
          this.transloco.translate('quotes.statusChanged', {
            folio: updated.folio,
            status: this.transloco.translate(`quotes.status.${updated.status}`),
          }),
        );
      },
      error: (error: unknown) => {
        reset();
        toast.error(mapApiError(error));
      },
    });
  }
}
