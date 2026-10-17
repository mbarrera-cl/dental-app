import { Injectable } from '@nestjs/common';
import { ClinicalRecordRepositoryPort } from '../../../application/ports/clinical-record-repository.port.js';
import type { ClinicalEvent } from '../../../domain/clinical-event.entity.js';
import {
  ClinicalFindingNotFoundError,
  ClinicalRecordAlreadyExistsError,
  ClinicalRecordNotFoundError,
} from '../../../domain/clinical.errors.js';
import type { FichaClinica } from '../../../domain/ficha-clinica.entity.js';
import type { Finding } from '../../../domain/finding.entity.js';

/**
 * Driven adapter: keeps the whole ficha in memory for local development and
 * unit tests. Binding it in `ClinicalModule` replaces the SQLite adapter —
 * nothing else in the codebase has to change.
 */
@Injectable()
export class InMemoryClinicalRecordRepository extends ClinicalRecordRepositoryPort {
  private readonly records = new Map<string, FichaClinica>();
  private readonly findings = new Map<string, Finding>();
  private readonly events = new Map<string, ClinicalEvent>();

  async save(record: FichaClinica): Promise<void> {
    for (const existing of this.records.values()) {
      if (existing.patientId === record.patientId && existing.id !== record.id) {
        throw new ClinicalRecordAlreadyExistsError(record.patientId);
      }
    }

    this.records.set(record.id, record);
  }

  async update(record: FichaClinica): Promise<void> {
    if (!this.records.has(record.id)) {
      throw new ClinicalRecordNotFoundError(record.id);
    }

    this.records.set(record.id, record);
  }

  async findById(id: string): Promise<FichaClinica | null> {
    return this.records.get(id) ?? null;
  }

  async findByPatientId(patientId: string): Promise<FichaClinica | null> {
    for (const record of this.records.values()) {
      if (record.patientId === patientId) {
        return record;
      }
    }

    return null;
  }

  async saveFinding(finding: Finding): Promise<void> {
    this.findings.set(finding.id, finding);
  }

  async updateFinding(finding: Finding): Promise<void> {
    if (!this.findings.has(finding.id)) {
      throw new ClinicalFindingNotFoundError(finding.id);
    }

    this.findings.set(finding.id, finding);
  }

  async findFinding(id: string): Promise<Finding | null> {
    return this.findings.get(id) ?? null;
  }

  async listFindings(recordId: string): Promise<Finding[]> {
    // Insertion order breaks ties when two findings share a millisecond.
    return [...this.findings.values()]
      .map((finding, index) => ({ finding, index }))
      .filter(({ finding }) => finding.recordId === recordId)
      .sort(
        (a, b) =>
          a.finding.createdAt.getTime() - b.finding.createdAt.getTime() ||
          a.index - b.index,
      )
      .map(({ finding }) => finding);
  }

  async appendEvent(event: ClinicalEvent): Promise<void> {
    this.events.set(event.id, event);
  }

  async listEvents(recordId: string): Promise<ClinicalEvent[]> {
    // Newest first; insertion order (reversed) breaks millisecond ties.
    return [...this.events.values()]
      .map((event, index) => ({ event, index }))
      .filter(({ event }) => event.recordId === recordId)
      .sort(
        (a, b) =>
          b.event.createdAt.getTime() - a.event.createdAt.getTime() ||
          b.index - a.index,
      )
      .map(({ event }) => event);
  }
}
