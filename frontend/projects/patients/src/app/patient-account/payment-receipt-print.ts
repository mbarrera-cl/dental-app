import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucidePrinter } from '@ng-icons/lucide';
import { HlmButton } from '@ui/button';
import { HlmSkeleton } from '@ui/skeleton';
import {
  BrandingApi,
  PatientsApi,
  PaymentsApi,
  type ClinicBranding,
  type Movement,
  type Patient,
} from 'data-access';

/**
 * Printable ledger receipt (comprobante interno): clinic identity, patient
 * snapshot, the movement and the balance it left behind. Printing is
 * delegated to the browser (`window.print()` → save as PDF), the same way
 * quotes, prescriptions and consents print. A voided movement prints its
 * annulment instead of the receipt.
 */
@Component({
  selector: 'app-payment-receipt-print',
  imports: [RouterLink, TranslocoPipe, NgIcon, HlmButton, HlmSkeleton],
  providers: provideIcons({ lucideArrowLeft, lucidePrinter }),
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mb-4 flex items-center gap-2 print:hidden">
      <a hlmBtn variant="outline" size="sm" [routerLink]="backLink()">
        <ng-icon name="lucideArrowLeft" />
        {{ 'patientAccount.print.back' | transloco }}
      </a>
      <button hlmBtn size="sm" (click)="print()" [disabled]="movement() === null">
        <ng-icon name="lucidePrinter" />
        {{ 'patientAccount.print.action' | transloco }}
      </button>
    </section>

    <article
      class="mx-auto max-w-3xl rounded-lg bg-white p-8 text-black shadow-sm print:max-w-none print:rounded-none print:p-0 print:shadow-none"
      data-testid="payment-receipt-document"
    >
      @if (movement(); as movement) {
        <header class="mb-6 flex items-start justify-between gap-6 border-b pb-4">
          <div class="flex items-center gap-3">
            @if (branding()?.logoUrl; as logo) {
              <img [src]="logo" class="h-14 w-auto max-w-40 object-contain" alt="" />
            } @else {
              <span
                class="flex size-12 items-center justify-center rounded-lg bg-neutral-800 text-xl font-bold text-white"
              >
                {{ initial() }}
              </span>
            }
            <div class="grid gap-0.5">
              <h1 class="text-lg font-semibold tracking-tight">
                {{ branding()?.name ?? 'Clínica' }}
              </h1>
              @if (branding()?.slogan; as slogan) {
                <p class="text-xs text-neutral-600">{{ slogan }}</p>
              }
            </div>
          </div>
          <div class="grid gap-0.5 text-right text-sm">
            <p class="text-base font-bold tracking-wide">
              {{ 'patientAccount.print.title' | transloco }}
            </p>
            <p>
              {{ 'patientAccount.print.date' | transloco }}: {{ formatDate(movement.createdAt) }}
            </p>
          </div>
        </header>

        @if (movement.voidedAt !== null) {
          <div
            class="mb-6 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-center text-sm font-bold tracking-wide text-red-700 uppercase"
          >
            {{ 'patientAccount.print.voided' | transloco }}
            @if (movement.voidReason; as reason) {
              <span class="block text-xs font-medium normal-case">· {{ reason }}</span>
            }
          </div>
        }

        <section class="mb-6 grid gap-1 text-sm">
          <h2 class="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
            {{ 'patientAccount.print.patient' | transloco }}
          </h2>
          <p class="font-medium">{{ patientName() }}</p>
          <p>
            {{ 'patientAccount.print.rut' | transloco }}:
            <span class="font-mono">{{ patient()?.rut ?? '—' }}</span>
          </p>
        </section>

        <table class="mb-6 w-full border-collapse text-sm">
          <tbody>
            <tr class="border-b border-neutral-200">
              <th class="py-1.5 text-left font-medium text-neutral-500">
                {{ 'patientAccount.print.concept' | transloco }}
              </th>
              <td class="py-1.5 text-left font-medium">{{ movement.concept }}</td>
            </tr>
            <tr class="border-b border-neutral-200">
              <th class="py-1.5 text-left font-medium text-neutral-500">
                {{ 'patientAccount.print.amount' | transloco }}
              </th>
              <td class="py-1.5 text-left font-semibold tabular-nums">
                {{ formatMoney(movement.amount) }}
              </td>
            </tr>
            <tr class="border-b border-neutral-200">
              <th class="py-1.5 text-left font-medium text-neutral-500">
                {{ 'patientAccount.print.method' | transloco }}
              </th>
              <td class="py-1.5 text-left">
                {{ methodLabel(movement) }}
                @if (movement.reference !== null) {
                  <span class="text-neutral-500">· {{ movement.reference }}</span>
                }
              </td>
            </tr>
            <tr class="border-b border-neutral-200">
              <th class="py-1.5 text-left font-medium text-neutral-500">
                {{ 'patientAccount.print.statusLabel' | transloco }}
              </th>
              <td class="py-1.5 text-left">
                {{
                  (movement.voidedAt === null
                    ? 'patientAccount.status.active'
                    : 'patientAccount.status.voided'
                  ) | transloco
                }}
              </td>
            </tr>
            <tr class="border-b border-neutral-200">
              <th class="py-1.5 text-left font-medium text-neutral-500">
                {{ 'patientAccount.print.remainingLabel' | transloco }}
              </th>
              <td class="py-1.5 text-left font-semibold tabular-nums">
                {{ formatMoney(balance()) }}
              </td>
            </tr>
          </tbody>
        </table>

        <footer class="grid gap-1 border-t pt-4 text-xs">
          @if (balance() === 0) {
            <p class="font-medium">{{ 'patientAccount.balancePaid' | transloco }}</p>
          }
          <!-- The clinic signature stays blank for hand signing at the counter. -->
          <div class="mt-10 grid gap-1">
            <div class="h-px w-64 bg-neutral-500"></div>
            <p class="text-neutral-500">{{ 'patientAccount.print.signature' | transloco }}</p>
          </div>
        </footer>
      } @else {
        <div class="grid gap-3 p-8">
          <div hlmSkeleton class="h-5 w-48"></div>
          <div hlmSkeleton class="h-4 w-full"></div>
          <div hlmSkeleton class="h-4 w-5/6"></div>
          <div hlmSkeleton class="h-4 w-2/3"></div>
        </div>
      }
    </article>
  `,
})
export class PaymentReceiptPrint {
  private readonly payments = inject(PaymentsApi);
  private readonly patients = inject(PatientsApi);
  private readonly brandingApi = inject(BrandingApi);
  private readonly route = inject(ActivatedRoute);
  private readonly transloco = inject(TranslocoService);

  protected readonly movement = signal<Movement | null>(null);
  protected readonly patient = signal<Patient | null>(null);
  protected readonly balance = signal(0);
  protected readonly branding = signal<ClinicBranding | null>(null);

  protected readonly initial = computed(() =>
    (this.branding()?.name ?? 'H').slice(0, 1).toUpperCase(),
  );

  protected readonly patientName = computed(() => {
    const patient = this.patient();

    return patient === null
      ? null
      : `${patient.nombres} ${patient.apellidoPaterno} ${patient.apellidoMaterno}`;
  });

  protected readonly backLink = computed(() => {
    const movement = this.movement();

    return movement === null ? ['/patients'] : ['/patients', movement.patientId, 'cuenta'];
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('movementId');

    if (id !== null) {
      this.payments.get(id).subscribe({
        next: (movement) => {
          this.movement.set(movement);

          // The receipt snapshots the patient and the balance that movement left.
          this.patients
            .getById(movement.patientId)
            .subscribe((patient) => this.patient.set(patient));
          this.payments
            .ledger(movement.patientId, { limit: 1 })
            .subscribe({ next: (ledger) => this.balance.set(ledger.balance) });
        },
        error: () => undefined,
      });
    }

    this.brandingApi.get().subscribe({
      next: (snapshot) => this.branding.set(snapshot.branding),
    });
  }

  protected print(): void {
    window.print();
  }

  protected methodLabel(movement: Movement): string {
    switch (movement.method) {
      case 'tarjeta':
        return this.transloco.translate('patientAccount.print.methodTarjeta');
      case 'transferencia':
        return this.transloco.translate('patientAccount.print.methodTransferencia');
      default:
        return this.transloco.translate('patientAccount.print.methodEfectivo');
    }
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
