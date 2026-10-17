/** A priced procedure in the UCO fee catalog (Arancel UCO). */
export interface UcoProcedure {
  id: string;
  /** Unique business key, e.g. `010001`. */
  code: string;
  chapter: string;
  name: string;
  /** Decimal UCO units. */
  units: number;
  status: UcoProcedureStatus;
  /** ISO-8601 timestamps. */
  createdAt: string;
  updatedAt: string;
}

export type UcoProcedureStatus = 'active' | 'inactive';

export interface CreateUcoProcedurePayload {
  code: string;
  chapter: string;
  name: string;
  units: number;
}

export type UpdateUcoProcedurePayload = Partial<CreateUcoProcedurePayload> & {
  /** Soft-delete toggle. */
  active?: boolean;
};
