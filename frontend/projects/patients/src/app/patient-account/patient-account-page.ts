import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBadgeDollarSign,
  lucideFileText,
  lucideLifeBuoy,
  lucidePrinter,
  lucideRefreshCw,
  lucideTriangleAlert,
  lucideCircleOff,
} from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HasPermissionDirective, PERMISSION_KEYS } from 'auth';
import { HlmBadge } from '@ui/badge';
import { HlmButton } from '@ui/button';
import { HlmInput } from '@ui/input';
import { HlmLabel } from '@ui/label';
import { HlmSkeleton } from '@ui/skeleton';
import { HlmTable, HlmTableContainer, HlmTBody, HlmTd, HlmTh, HlmTHead, HlmTr } from '@ui/table';
import { mapApiError, PaymentsApi, type Ledger, type Movement, type PaymentMethod } from 'data-access';
import { ClinicalRecordStore } from '../clinical-record.store';

const PAYMENT_METHOD_KEYS: Record<PaymentMethod, string> = {
  efectivo: 'patientAccount.payment.methodEfectivo',
  tarjeta: 'patientAccount.payment.methodTarjeta',
  transferencia: 'patientAccount.payment.methodTransferencia',
};

/**
 * «Cuenta» tab of the patient profile: the balance (computed, never stored),
 * the append-only ledger and the actions — record a charge (cargo), record a
 * payment (abono) and void a movement. The receipt (comprobante) links out to
 * the printable view.
 */
@Component({
  selector: 'app-patient-account-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    NgIcon,
    HlmBadge,
    HlmButton,
    HlmInput,
    HlmLabel,
    HlmSkeleton,
    HlmTableContainer,
    HlmTable,
    HlmTHead,
    HlmTBody,
    HlmTr,
    HlmTh,
    HlmTd,
    HasPermissionDirective,
  ],
  providers: provideIcons({
    lucideBadgeDollarSign,
    lucideCircleOff,
    lucideFileText,
    lucideLifeBuoy,
    lucidePrinter,
    lucideRefreshCw,
    lucideTriangleAlert,
  }),
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col gap-6" data-testid="patient-account">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div class="grid gap-0.5">
          <h3 class="font-semibold">{{ 'patientAccount.title' | transloco }}</h3>
          <p class="text-muted-foreground text-sm">{{ 'patientAccount.subtitle' | transloco }}</p>
        </div>
        <button hlmBtn variant="outline" size="sm" (click)="load()" [disabled]="loading()">
          <ng-icon name="lucideRefreshCw" />
          {{ 'common.refresh' | transloco }}
        </button>
      </header>

      @if (loadError(); as errorKey) {
        <div
          class="border-destructive/30 bg-destructive/5 text-destructive flex items-center gap-3 rounded-lg border px-4 py-3 text-sm"
        >
          <ng-icon name="lucideTriangleAlert" class="shrink-0" />
          <p class="flex-1">{{ errorKey | transloco }}</p>
          <button hlmBtn variant="outline" size="sm" (click)="load()">
            {{ 'common.retry' | transloco }}
          </button>
        </div>
      }

      <!-- Saldo único por paciente: computed, never stored. -->
      <div
        class="bg-card flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
        data-testid="patient-account-balance"
      >
        <div class="grid gap-1">
          <p class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {{ 'patientAccount.balance' | transloco }}
          </p>
          <p class="text-2xl font-semibold tabular-nums" data-testid="patient-account-balance-value">
            {{ formatMoney(ledger()?.balance ?? 0) }}
          </p>
        </div>
        <span
          hlmBadge
          [variant]="isPaid() ? 'secondary' : 'default'"
          data-testid="patient-account-balance-state"
        >
          {{ (isPaid() ? 'patientAccount.balancePaid' : 'patientAccount.balance') | transloco }}
        </span>
      </div>

      @if (voidingTarget(); as target) {
        <div
          class="bg-card grid gap-3 rounded-lg border px-4 py-3"
          data-testid="patient-account-void-form"
        >
          <div class="grid gap-1">
            <h4 class="text-sm font-semibold">{{ 'patientAccount.void.title' | transloco }}</h4>
            <p class="text-muted-foreground text-xs">
              {{ target.concept }} · {{ formatMoney(target.amount) }} ·
              {{ 'patientAccount.void.description' | transloco }}
            </p>
          </div>
          <div class="grid gap-2 sm:max-w-md">
            <label hlmLabel for="account-void-reason">
              {{ 'patientAccount.void.reason' | transloco }}
            </label>
            <input
              hlmInput
              id="account-void-reason"
              autocomplete="off"
              [value]="voidReason()"
              (input)="voidReason.set($any($event.target).value)"
              [placeholder]="'patientAccount.void.reasonPlaceholder' | transloco"
              data-testid="patient-account-void-reason"
            />
          </div>
          <div class="flex justify-end gap-2">
            <button hlmBtn variant="outline" size="sm" (click)="cancelVoid()">
              {{ 'common.cancel' | transloco }}
            </button>
            <button
              hlmBtn
              variant="destructive"
              size="sm"
              [disabled]="voidReason().trim() === '' || saving()"
              (click)="submitVoid()"
              data-testid="patient-account-void-submit"
            >
              <ng-icon name="lucideCircleOff" />
              {{ 'patientAccount.void.submit' | transloco }}
            </button>
          </div>
        </div>
      }

      @if (canCreate()) {
        <div class="grid gap-4 md:grid-cols-2" data-testid="patient-account-forms">
          <form class="bg-card grid gap-4 rounded-lg border p-4" (submit)="submitCharge($event)" data-testid="patient-account-charge-form">
            <h4 class="text-lg font-semibold">
              {{ 'patientAccount.charge.title' | transloco }}
            </h4>
            <div class="grid gap-2">
              <label hlmLabel for="charge-concept">{{ 'patientAccount.charge.concept' | transloco }}</label>
              <input
                hlmInput
                id="charge-concept"
                autocomplete="off"
                [value]="chargeConcept()"
                (input)="chargeConcept.set($any($event.target).value)"
                [placeholder]="'patientAccount.charge.conceptPlaceholder' | transloco"
                data-testid="patient-account-charge-concept"
              />
            </div>
            <div class="grid gap-2">
              <label hlmLabel for="charge-amount">{{ 'patientAccount.charge.amount' | transloco }}</label>
              <input
                hlmInput
                id="charge-amount"
                type="number"
                min="1"
                step="1"
                autocomplete="off"
                [value]="chargeAmount()"
                (input)="chargeAmount.set($any($event.target).value)"
                data-testid="patient-account-charge-amount"
              />
            </div>
            <div class="flex justify-end">
              <button hlmBtn type="submit" [disabled]="!canSubmitCharge() || saving()" variant="outline" data-testid="patient-account-charge-submit">
                {{ 'patientAccount.charge.submit' | transloco }}
              </button>
            </div>
          </form>

          <form class="bg-card grid gap-4 rounded-lg border p-4" (submit)="submitPayment($event)" data-testid="patient-account-payment-form">
            <h4 class="text-lg font-semibold">
              {{ 'patientAccount.payment.title' | transloco }}
            </h4>
            <div class="grid gap-2">
              <label hlmLabel for="payment-method">{{ 'patientAccount.payment.method' | transloco }}</label>
              <select
                hlmInput
                id="payment-method"
                (change)="paymentMethod.set($any($event.target).value)"
                data-testid="patient-account-payment-method"
              >
                @for (method of methods; track method) {
                  <option [value]="method" [selected]="method === paymentMethod()">
                    {{ methodLabel(method) | transloco }}
                  </option>
                }
              </select>
            </div>
            <div class="grid gap-2">
              <label hlmLabel for="payment-concept">{{ 'patientAccount.payment.concept' | transloco }}</label>
              <input
                hlmInput
                id="payment-concept"
                autocomplete="off"
                [value]="paymentConcept()"
                (input)="paymentConcept.set($any($event.target).value)"
                [placeholder]="'patientAccount.payment.conceptPlaceholder' | transloco"
                data-testid="patient-account-payment-concept"
              />
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="grid gap-2">
                <label hlmLabel for="payment-amount">{{ 'patientAccount.payment.amount' | transloco }}</label>
                <input
                  hlmInput
                  id="payment-amount"
                  type="number"
                  min="1"
                  step="1"
                  autocomplete="off"
                  [value]="paymentAmount()"
                  (input)="paymentAmount.set($any($event.target).value)"
                  data-testid="patient-account-payment-amount"
                />
              </div>
              <div class="grid gap-2">
                <label hlmLabel for="payment-reference">{{ 'patientAccount.payment.reference' | transloco }}</label>
                <input
                  hlmInput
                  id="payment-reference"
                  autocomplete="off"
                  [value]="paymentReference()"
                  (input)="paymentReference.set($any($event.target).value)"
                  [placeholder]="'patientAccount.payment.referencePlaceholder' | transloco"
                  data-testid="patient-account-payment-reference"
                />
              </div>
            </div>
            <div class="flex justify-end">
              <button hlmBtn type="submit" [disabled]="!canSubmitPayment() || saving()" variant="outline" data-testid="patient-account-payment-submit">
                {{ 'patientAccount.payment.submit' | transloco }}
              </button>
            </div>
          </form>
        </div>
      }

      <div hlmTableContainer class="bg-card rounded-lg border">
        <table hlmTable>
          <thead hlmTHead>
            <tr hlmTr>
              <th hlmTh>{{ 'patientAccount.table.date' | transloco }}</th>
              <th hlmTh>{{ 'patientAccount.table.concept' | transloco }}</th>
              <th hlmTh class="hidden sm:table-cell">{{ 'patientAccount.table.method' | transloco }}</th>
              <th hlmTh class="text-end">{{ 'patientAccount.table.amount' | transloco }}</th>
              <th hlmTh>{{ 'patientAccount.table.status' | transloco }}</th>
              <th hlmTh class="text-end">{{ 'patientAccount.table.actions' | transloco }}</th>
            </tr>
          </thead>
          <tbody hlmTBody>
            @if (loading()) {
              @for (row of skeletonRows; track row) {
                <tr hlmTr>
                  <td hlmTd><div hlmSkeleton class="h-4 w-24"></div></td>
                  <td hlmTd><div hlmSkeleton class="h-4 w-56"></div></td>
                  <td hlmTd class="hidden sm:table-cell"><div hlmSkeleton class="h-4 w-20"></div></td>
                  <td hlmTd><div hlmSkeleton class="ms-auto h-4 w-20"></div></td>
                  <td hlmTd><div hlmSkeleton class="h-5 w-16"></div></td>
                  <td hlmTd><div hlmSkeleton class="ms-auto h-8 w-16"></div></td>
                </tr>
              }
            } @else if (movements().length === 0) {
              <tr hlmTr>
                <td hlmTd colspan="6" class="py-12">
                  <div class="text-muted-foreground flex flex-col items-center gap-2 text-center">
                    <ng-icon name="lucideLifeBuoy" class="size-6" />
                    <p>{{ 'patientAccount.empty' | transloco }}</p>
                  </div>
                </td>
              </tr>
            } @else {
              @for (movement of movements(); track movement.id) {
                <tr hlmTr data-testid="patient-account-row">
                  <td hlmTd class="whitespace-nowrap text-sm">{{ formatDate(movement.createdAt) }}</td>
                  <td hlmTd>
                    <div class="grid gap-0.5">
                      <span class="font-medium">{{ movement.concept }}</span>
                      @if (movement.quoteId !== null) {
                        <span
                          class="text-muted-foreground inline-flex items-center gap-1 text-xs"
                          data-testid="patient-account-quote-origin"
                        >
                          <ng-icon name="lucideFileText" class="size-3" />
                          {{ 'patientAccount.table.quoteLabel' | transloco }}
                        </span>
                      }
                      @if (movement.reference !== null) {
                        <span class="text-muted-foreground text-xs">
                          {{ 'patientAccount.table.referenceLabel' | transloco }}:
                          {{ movement.reference }}
                        </span>
                      }
                    </div>
                  </td>
                  <td hlmTd class="hidden sm:table-cell text-sm">
                    {{ movementLabel(movement) }}
                  </td>
                  <td hlmTd class="text-end font-medium tabular-nums">
                    {{ formatMoney(movement.signedAmount) }}
                  </td>
                  <td hlmTd>
                    <span
                      hlmBadge
                      [variant]="movement.voidedAt === null ? 'outline' : 'destructive'"
                      [attr.data-testid]="
                        movement.voidedAt === null
                          ? 'patient-account-status-active'
                          : 'patient-account-status-voided'
                      "
                    >
                      {{
                        (movement.voidedAt === null
                          ? 'patientAccount.status.active'
                          : 'patientAccount.status.voided') | transloco
                      }}
                    </span>
                  </td>
                  <td hlmTd>
                    <div class="flex justify-end gap-1">
                      <a
                        hlmBtn
                        variant="ghost"
                        size="icon-sm"
                        [routerLink]="['/patients', 'cuenta', movement.id, 'imprimir']"
                        [attr.aria-label]="'patientAccount.print.action' | transloco"
                        [attr.data-testid]="'patient-account-print-' + movement.id"
                      >
                        <ng-icon name="lucidePrinter" />
                      </a>
                      @if (movement.voidedAt === null) {
                        <button
                          *hasPermission="permissionKeys.payments.void"
                          hlmBtn
                          variant="ghost"
                          size="icon-sm"
                          (click)="startVoid(movement)"
                          [attr.aria-label]="'patientAccount.void.action' | transloco"
                          [attr.data-testid]="'patient-account-void-' + movement.id"
                        >
                          <ng-icon name="lucideCircleOff" />
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class PatientAccountPage {
  private readonly api = inject(PaymentsApi);
  private readonly store = inject(ClinicalRecordStore);
  private readonly transloco = inject(TranslocoService);

  protected readonly permissionKeys = PERMISSION_KEYS;
  protected readonly methods: PaymentMethod[] = ['efectivo', 'tarjeta', 'transferencia'];
  protected readonly skeletonRows = [0, 1, 2];

  protected readonly ledger = signal<Ledger | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected readonly chargeConcept = signal('');
  protected readonly chargeAmount = signal('');
  protected readonly paymentConcept = signal('');
  protected readonly paymentAmount = signal('');
  protected readonly paymentMethod = signal<PaymentMethod>('efectivo');
  protected readonly paymentReference = signal('');

  /** The movement waiting to be voided (`null` → the void panel is hidden). */
  protected readonly voidingTarget = signal<Movement | null>(null);
  protected readonly voidReason = signal('');

  protected readonly movements = computed(() => this.ledger()?.movements ?? []);
  protected readonly isPaid = computed(() => (this.ledger()?.balance ?? 0) === 0);

  protected readonly canCreate = computed(() => this.store.patientId() !== '');

  constructor() {
    this.load();
  }

  protected load(): void {
    const patientId = this.store.patientId();

    if (patientId === '') {
      return;
    }

    this.loading.set(true);
    this.loadError.set(null);

    this.api.ledger(patientId, { limit: 50 }).subscribe({
      next: (ledger) => this.ledger.set(ledger),
      error: (error: unknown) => {
        this.loadError.set(mapApiError(error));
        this.ledger.set(null);
      },
      complete: () => this.loading.set(false),
    });
  }

  private parseAmount(raw: string): number {
    const trimmed = raw.trim();

    if (trimmed === '' || !/^\d+$/.test(trimmed)) {
      return 0;
    }

    return Number(trimmed);
  }

  protected canSubmitCharge(): boolean {
    return this.chargeConcept().trim() !== '' && this.parseAmount(this.chargeAmount()) > 0;
  }

  protected canSubmitPayment(): boolean {
    return this.paymentConcept().trim() !== '' && this.parseAmount(this.paymentAmount()) > 0;
  }

  protected submitCharge(event: Event): void {
    event.preventDefault();

    const patientId = this.store.patientId();
    const amount = this.parseAmount(this.chargeAmount());

    if (patientId === '' || !this.canSubmitCharge() || this.saving() || amount <= 0) {
      return;
    }

    this.saving.set(true);

    this.api
      .recordCharge(patientId, { concept: this.chargeConcept().trim(), amount })
      .subscribe({
        next: () => {
          toast.success(this.transloco.translate('patientAccount.charge.toast'));
          this.chargeConcept.set('');
          this.chargeAmount.set('');
          this.saving.set(false);
          this.load();
        },
        error: (error: unknown) => {
          toast.error(this.transloco.translate(mapApiError(error)));
          this.saving.set(false);
        },
      });
  }

  protected submitPayment(event: Event): void {
    event.preventDefault();

    const patientId = this.store.patientId();
    const amount = this.parseAmount(this.paymentAmount());

    if (patientId === '' || !this.canSubmitPayment() || this.saving() || amount <= 0) {
      return;
    }

    this.saving.set(true);
    const reference = this.paymentReference().trim();

    this.api
      .recordPayment(patientId, {
        concept: this.paymentConcept().trim(),
        amount,
        method: this.paymentMethod(),
        reference: reference === '' ? null : reference,
      })
      .subscribe({
        next: () => {
          toast.success(this.transloco.translate('patientAccount.payment.toast'));
          this.paymentConcept.set('');
          this.paymentAmount.set('');
          this.paymentReference.set('');
          this.saving.set(false);
          this.load();
        },
        error: (error: unknown) => {
          toast.error(this.transloco.translate(mapApiError(error)));
          this.saving.set(false);
        },
      });
  }

  protected startVoid(movement: Movement): void {
    this.voidingTarget.set(movement);
    this.voidReason.set('');
  }

  protected cancelVoid(): void {
    this.voidingTarget.set(null);
    this.voidReason.set('');
  }

  protected submitVoid(): void {
    const target = this.voidingTarget();
    const reason = this.voidReason().trim();

    if (target === null || reason === '' || this.saving()) {
      return;
    }

    this.saving.set(true);

    this.api.void(target.id, reason).subscribe({
      next: () => {
        toast.success(this.transloco.translate('patientAccount.void.toast'));
        this.voidingTarget.set(null);
        this.voidReason.set('');
        this.saving.set(false);
        this.load();
      },
      error: (error: unknown) => {
        toast.error(this.transloco.translate(mapApiError(error)));
        this.saving.set(false);
      },
    });
  }

  protected methodLabel(method: PaymentMethod): string {
    return PAYMENT_METHOD_KEYS[method];
  }

  protected movementLabel(movement: Movement): string {
    return movement.method === null ? '—' : this.methodLabel(movement.method);
  }

  protected formatMoney(value: number): string {
    return new Intl.NumberFormat(this.transloco.getActiveLang() === 'en' ? 'en-US' : 'es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(value);
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat(this.transloco.getActiveLang() === 'en' ? 'en-US' : 'es-CL', {
      dateStyle: 'medium',
    }).format(new Date(value));
  }
}
