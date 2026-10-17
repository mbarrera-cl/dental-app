import { Injectable } from '@nestjs/common';
import type { McpContext } from '@rekog/mcp-nest';
import { z } from 'zod';
import type { Principal } from '../../../../shared/security/principal.js';
import type { DeepSeekToolDefinition } from '../../../caro-ia/application/deepseek.client.js';
import { ActivityTools } from '../tools/activity.tools.js';
import { PatientsTools } from '../tools/patients.tools.js';
import { QuotesTools } from '../tools/quotes.tools.js';
import { UcoTools } from '../tools/uco.tools.js';

export const NO_ANSWER_TOOL_NAME = 'hexa_no_answer';

interface ToolMetadata {
  name: string;
  description: string;
  parameters?: z.ZodType | Record<string, unknown>;
}

type ToolInstance = Record<string, (...args: never[]) => unknown>;

interface CatalogEntry {
  name: string;
  instance: ToolInstance;
  method: string;
  permissions: readonly string[];
  match?: 'all' | 'any';
  write: boolean;
  confirm: boolean;
  label: string;
}

export interface CatalogToolResult {
  data: unknown;
  summary: string;
}

export interface ApprovalDescription {
  title: string;
  summary: string;
  parameters: Array<{ label: string; value: string }>;
}

const ENTRIES: readonly Omit<CatalogEntry, 'instance' | 'method'>[] = [
  {
    name: 'hexa_patients_search',
    permissions: ['patients:read'],
    write: false,
    confirm: false,
    label: 'Buscó pacientes',
  },
  {
    name: 'hexa_patients_get',
    permissions: ['patients:read'],
    write: false,
    confirm: false,
    label: 'Consultó un paciente',
  },
  {
    name: 'hexa_uco_search',
    permissions: ['uco:read'],
    write: false,
    confirm: false,
    label: 'Buscó en el arancel UCO',
  },
  {
    name: 'hexa_uco_get',
    permissions: ['uco:read'],
    write: false,
    confirm: false,
    label: 'Consultó el arancel UCO',
  },
  {
    name: 'hexa_quotes_list',
    permissions: ['quotes:read'],
    write: false,
    confirm: false,
    label: 'Listó presupuestos',
  },
  {
    name: 'hexa_quotes_get',
    permissions: ['quotes:read'],
    write: false,
    confirm: false,
    label: 'Consultó un presupuesto',
  },
  {
    name: 'hexa_quotes_versions',
    permissions: ['quotes:read'],
    write: false,
    confirm: false,
    label: 'Consultó versiones de un presupuesto',
  },
  {
    name: 'hexa_quotes_create',
    permissions: ['quotes:create'],
    write: true,
    confirm: false,
    label: 'Creó un presupuesto',
  },
  {
    name: 'hexa_quotes_update',
    permissions: ['quotes:update'],
    write: true,
    confirm: false,
    label: 'Actualizó un presupuesto',
  },
  {
    name: 'hexa_quotes_duplicate',
    permissions: ['quotes:create'],
    write: true,
    confirm: false,
    label: 'Duplicó un presupuesto',
  },
  {
    name: 'hexa_quotes_decide_item',
    permissions: ['quotes:update'],
    write: true,
    confirm: true,
    label: 'Decidió una línea de presupuesto',
  },
  {
    name: 'hexa_quotes_sanction',
    permissions: ['quotes:approve'],
    write: true,
    confirm: true,
    label: 'Aprobó o rechazó un presupuesto',
  },
  {
    name: 'hexa_quotes_delete',
    permissions: ['quotes:delete'],
    write: true,
    confirm: true,
    label: 'Envió un presupuesto a la papelera',
  },
  {
    name: 'hexa_quotes_restore',
    permissions: ['quotes:delete'],
    write: true,
    confirm: true,
    label: 'Restauró un presupuesto',
  },
  {
    name: 'hexa_activity_list',
    permissions: ['activity:read', 'activity:read-all'],
    match: 'any',
    write: false,
    confirm: false,
    label: 'Consultó la actividad',
  },
];

const METHODS: Readonly<Record<string, string>> = {
  hexa_patients_search: 'search',
  hexa_patients_get: 'get',
  hexa_uco_search: 'search',
  hexa_uco_get: 'get',
  hexa_quotes_list: 'list',
  hexa_quotes_get: 'get',
  hexa_quotes_versions: 'versions',
  hexa_quotes_create: 'create',
  hexa_quotes_update: 'update',
  hexa_quotes_duplicate: 'duplicate',
  hexa_quotes_decide_item: 'decideItem',
  hexa_quotes_sanction: 'sanction',
  hexa_quotes_delete: 'remove',
  hexa_quotes_restore: 'restore',
  hexa_activity_list: 'list',
};

const NO_ANSWER_TOOL: DeepSeekToolDefinition = {
  type: 'function',
  function: {
    name: NO_ANSWER_TOOL_NAME,
    description:
      'Use this when the request cannot be answered with the Hexa MCP tools (general knowledge, chit-chat or out-of-scope topics). It returns a fixed refusal.',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Short internal reason, never shown to the user.' },
      },
      additionalProperties: false,
    },
  },
};

/**
 * Read/write facade over the existing MCP tool classes. The tools keep their
 * own permission, write-gate, redaction and audit checks; CaroIA only needs a
 * catalog for DeepSeek and a single execution entry point that runs as the
 * logged-in user instead of a shared API key.
 */
@Injectable()
export class McpToolCatalog {
  private readonly entries: readonly CatalogEntry[];

  constructor(
    quotes: QuotesTools,
    patients: PatientsTools,
    uco: UcoTools,
    activity: ActivityTools,
  ) {
    const instances: Record<string, ToolInstance> = {
      Patients: patients as unknown as ToolInstance,
      Uco: uco as unknown as ToolInstance,
      Quotes: quotes as unknown as ToolInstance,
      Activity: activity as unknown as ToolInstance,
    };

    this.entries = ENTRIES.map((entry) => ({
      ...entry,
      instance: instanceFor(entry.name, instances),
      method: METHODS[entry.name]!,
    }));
  }

  /** Tool definitions DeepSeek may call, filtered by the user's permissions. */
  definitions(principal: Principal, includeWrites: boolean): DeepSeekToolDefinition[] {
    return this.entries
      .filter((entry) => (includeWrites || !entry.write) && this.allowed(entry, principal))
      .map((entry) => this.definitionOf(entry));
  }

  hasDomainTools(principal: Principal, includeWrites: boolean): boolean {
    return this.entries.some(
      (entry) => (includeWrites || !entry.write) && this.allowed(entry, principal),
    );
  }

  isWrite(name: string): boolean {
    return this.entries.find((entry) => entry.name === name)?.write ?? false;
  }

  labelOf(name: string): string {
    return this.entries.find((entry) => entry.name === name)?.label ?? `Consultó ${name}`;
  }

  hasTool(name: string, principal: Principal): boolean {
    const entry = this.entries.find((candidate) => candidate.name === name);

    return entry !== undefined && this.allowed(entry, principal);
  }

  async execute(
    name: string,
    arguments_: Record<string, unknown>,
    principal: Principal,
  ): Promise<CatalogToolResult> {
    const entry = this.entries.find((candidate) => candidate.name === name);

    if (entry === undefined || !this.allowed(entry, principal)) {
      throw new Error(`Tool not available: ${name}`);
    }

    const metadata = this.metadataOf(entry);
    const parsed = this.validate(metadata, arguments_, name);
    const payload = entry.confirm ? { ...parsed, confirm: true } : parsed;
    const ctx = { getRawRequest: () => ({ user: principal }) } as unknown as McpContext;
    const method = entry.instance[entry.method] as unknown as (
      args: unknown,
      context: McpContext,
    ) => Promise<{
      content?: Array<{ type: string; text: string }>;
      isError?: boolean;
    }>;

    const result = await method.call(entry.instance, payload, ctx);
    const text = result.content?.[0]?.text ?? '';

    if (result.isError === true) {
      throw new Error(text || `Tool failed: ${name}`);
    }

    let data: unknown = text;

    try {
      data = JSON.parse(text);
    } catch {
      // Some tools return a plain-text result; keep it as evidence.
    }

    return { data, summary: summarize(name, data) };
  }

  describeApproval(name: string, arguments_: Record<string, unknown>): ApprovalDescription {
    const label = this.labelOf(name);
    const parameters = approvalParameters(arguments_);
    const title = name === 'hexa_quotes_create' ? 'Crear presupuesto' : label;
    const summary =
      name === 'hexa_quotes_create'
        ? 'Se creará un presupuesto en borrador. Revisa los datos antes de aprobar.'
        : 'Se ejecutará una acción de escritura en Hexa. Revisa los datos antes de aprobar.';

    return { title, summary, parameters };
  }

  private definitionOf(entry: CatalogEntry): DeepSeekToolDefinition {
    const metadata = this.metadataOf(entry);

    return {
      type: 'function',
      function: {
        name: entry.name,
        description: metadata.description,
        parameters: toJsonSchema(metadata.parameters),
      },
    };
  }

  private metadataOf(entry: CatalogEntry): ToolMetadata {
    const fn = entry.instance[entry.method] as unknown as object;
    const metadata = Reflect.getMetadata('mcp:tool', fn) as ToolMetadata | undefined;

    if (metadata === undefined) {
      throw new Error(`Missing MCP metadata for ${entry.name}`);
    }

    return metadata;
  }

  private validate(
    metadata: ToolMetadata,
    arguments_: Record<string, unknown>,
    name: string,
  ): Record<string, unknown> {
    if (!(metadata.parameters instanceof z.ZodType)) {
      return arguments_;
    }

    const parsed = metadata.parameters.safeParse(arguments_);

    if (!parsed.success) {
      throw new Error(`Invalid arguments for ${name}: ${parsed.error.message}`);
    }

    return parsed.data as Record<string, unknown>;
  }

  private allowed(entry: CatalogEntry, principal: Principal): boolean {
    return entry.match === 'any'
      ? entry.permissions.some((permission) => principal.permissions.has(permission))
      : entry.permissions.every((permission) => principal.permissions.has(permission));
  }
}

function instanceFor(name: string, instances: Record<string, ToolInstance>): ToolInstance {
  if (name.startsWith('hexa_patients_')) {
    return instances.Patients!;
  }

  if (name.startsWith('hexa_uco_')) {
    return instances.Uco!;
  }

  if (name.startsWith('hexa_quotes_')) {
    return instances.Quotes!;
  }

  return instances.Activity!;
}

function toJsonSchema(schema: ToolMetadata['parameters']): Record<string, unknown> {
  if (schema === undefined) {
    return { type: 'object', properties: {}, additionalProperties: false };
  }

  if (!(schema instanceof z.ZodType)) {
    return schema;
  }

  const json = z.toJSONSchema(schema, { target: 'draft-7' }) as Record<string, unknown>;
  delete json.$schema;

  return json;
}

function summarize(name: string, data: unknown): string {
  const record = data as Record<string, unknown> | null;

  if (record === null || typeof record !== 'object') {
    return 'OK';
  }

  if (name === 'hexa_quotes_get' && isRecord(record.quote)) {
    return `${display(record.quote.folio)} · ${display(record.quote.status)}`;
  }

  if (name === 'hexa_quotes_create' && isRecord(record.quote)) {
    return `${display(record.quote.folio)} · borrador`;
  }

  if (name === 'hexa_quotes_update' && isRecord(record.quote)) {
    return `${display(record.quote.folio)} · actualizado`;
  }

  if (name === 'hexa_quotes_duplicate' && isRecord(record.quote)) {
    return `${display(record.quote.folio)} · duplicado`;
  }

  if (name === 'hexa_quotes_sanction' && isRecord(record.quote)) {
    return `${display(record.quote.folio)} · ${display(record.quote.status)}`;
  }

  const items = Array.isArray(record.items) ? record.items.length : null;

  if (items !== null) {
    return `${items} resultado${items === 1 ? '' : 's'}`;
  }

  return 'OK';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function display(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value === null || value === undefined) {
    return '';
  }

  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function approvalParameters(
  arguments_: Record<string, unknown>,
): Array<{ label: string; value: string }> {
  const parameters: Array<{ label: string; value: string }> = [];
  const add = (label: string, value: unknown): void => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    parameters.push({ label, value: display(value).slice(0, 120) });
  };

  add('Paciente', arguments_.patientRut ?? arguments_.patientId);
  add('Presupuesto', arguments_.quoteId);
  add('Línea', arguments_.itemId);
  add('Estado', arguments_.status);

  if (Array.isArray(arguments_.items)) {
    add('Líneas', arguments_.items.length);
  }

  add('Notas', arguments_.notes);

  return parameters;
}

export function noAnswerTool(): DeepSeekToolDefinition {
  return NO_ANSWER_TOOL;
}
