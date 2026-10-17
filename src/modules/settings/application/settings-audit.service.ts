import { Injectable } from '@nestjs/common';
import type {
  SettingChange,
  SettingsAuditActor,
  SettingsAuditEntry,
} from '../domain/settings-audit.js';
import { SettingsAuditRepositoryPort } from './ports/settings-audit-repository.port.js';

export const DEFAULT_AUDIT_LIMIT = 20;
const MAX_AUDIT_LIMIT = 100;

/**
 * Writes the configuration audit trail. Empty diffs are dropped, so a
 * no-op update never pollutes the history.
 */
@Injectable()
export class SettingsAuditService {
  constructor(private readonly repository: SettingsAuditRepositoryPort) {}

  async record(actor: SettingsAuditActor, changes: readonly SettingChange[]): Promise<void> {
    if (changes.length === 0) {
      return;
    }

    await this.repository.append({
      at: new Date().toISOString(),
      actorId: actor.id,
      actorType: actor.type,
      changes: [...changes],
    });
  }

  /** Newest first. `limit` is clamped to a sane window. */
  async list(limit = DEFAULT_AUDIT_LIMIT): Promise<SettingsAuditEntry[]> {
    const safeLimit = Number.isFinite(limit)
      ? Math.min(MAX_AUDIT_LIMIT, Math.max(1, Math.trunc(limit)))
      : DEFAULT_AUDIT_LIMIT;

    return this.repository.list(safeLimit);
  }
}
