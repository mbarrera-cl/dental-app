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
import { HlmButton } from '@ui/button';
import { HlmInput } from '@ui/input';
import { HlmLabel } from '@ui/label';
import { HlmSkeleton } from '@ui/skeleton';
import { HasPermissionDirective, PERMISSION_KEYS } from 'auth';
import {
  mapApiError,
  PatientsApi,
  QuotesApi,
  UcoApi,
  type Patient,
  type Quote,
  type QuoteItem,
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
    HlmButton,
    HlmInput,
    HlmLabel,
    HlmSkeleton,
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
            {{ editing() ? 'quotes.edit.title' : 'quotes.new.title' | transloco }}
          </h2>
          <p class="text-muted-foreground text-sm">
            @if (quote(); as quote) {
              {{ quote.folio }} · {{ 'quotes.status.' + quote.status | transloco }}
            } @else {
              {{ 'quotes.new.subtitle' | transloco }}
            }
          </p>
        </div>
      </header>

      @if (loadError(); as errorKey) {
        <div class="border-destructive/30 bg-destructive/5 text-destructive flex items-center gap-3 rounded-lg border px-4 py-3 text-sm">
          <ng-icon name="lucideTriangleAlert" class="shrink-0" />
          <p class="flex-1">{{ errorKey | transloco }}</p>
        </div>
      }

      <!-- Patient picker -->
      <div class="bg-card grid gap-4 rounded-lg border p-4">
        <div class="grid gap-2">
          <label hlmLabel>{{ 'quotes.editor.patient' | transloco }}</label>
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
          @if (quote()?.patientName; as name) {
            <p class="text-muted-foreground text-sm">{{ 'quotes.editor.selectedPatient' | transloco }}: <span class="font-medium">{{ name }}</span></p>
          }
        </div>
      </div>

      <!-- Items -->
      <div class="bg-card rounded-lg border">
        <div class="flex items-center justify-between gap-2 border-b px-4 py-3">
          <h3 class="font-semibold">{{ 'quotes.editor.items' | transloco }}</h3>
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
            <div class="border-input grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_80px_110px_90px_90px_40px]">
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
              <div class="grid gap-1 items-end">
                <span class="text-muted-foreground text-xs">{{ 'quotes.editor.net' | transloco }}</span>
                <span class="font-medium tabular-nums">{{ formatMoney(netOf(item)) }}</span>
              </div>
              <div class="flex items-end justify-end">
                <button hlmBtn variant="ghost" size="icon-sm" type="button" (click)="removeItem($index)">
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

        <div class="flex gap-2">
          @if (editing()) {
            <button hlmBtn variant="outline" type="button" (click)="save()">{{ 'common.save' | transloco }}</button>
          }
          <button hlmBtn type="button" (click)="create()" [disabled]="!canCreate()" data-testid="quote-save">
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

  protected readonly permissionKeys = PERMISSION_KEYS;

  protected readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly quote = signal<Quote | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly patientQuery = signal('');
  protected readonly patients = signal<Patient[]>([]);
  protected readonly selectedPatientId = signal<string | null>(null);

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
    const needle = this.ucoQuery().toLowerCase();

    return this.procedures().filter(
      (procedure) =>
        needle.length === 0 ||
        procedure.code.toLowerCase().includes(needle) ||
        procedure.name.toLowerCase().includes(needle),
    );
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

  protected save(): void {
    this.create();
  }
}
