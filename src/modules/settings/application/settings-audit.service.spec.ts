import type { SettingsAuditEntry, SettingsAuditRecord } from '../domain/settings-audit.js';
import { SettingsAuditRepositoryPort } from './ports/settings-audit-repository.port.js';
import { SettingsAuditService } from './settings-audit.service.js';

class FakeAuditRepository extends SettingsAuditRepositoryPort {
  records: SettingsAuditRecord[] = [];
  lastLimit: number | null = null;

  async append(record: SettingsAuditRecord): Promise<void> {
    this.records.push(record);
  }

  async list(limit: number): Promise<SettingsAuditEntry[]> {
    this.lastLimit = limit;

    return [];
  }
}

describe('SettingsAuditService', () => {
  const setup = () => {
    const repository = new FakeAuditRepository();
    const service = new SettingsAuditService(repository);

    return { repository, service };
  };

  it('stamps the record and persists it', async () => {
    const { repository, service } = setup();

    await service.record({ id: 'user-1', type: 'user' }, [
      { key: 'clinic.name', from: 'A', to: 'B' },
    ]);

    expect(repository.records).toHaveLength(1);
    expect(repository.records[0]!.actorId).toBe('user-1');
    expect(repository.records[0]!.actorType).toBe('user');
    expect(Number.isNaN(Date.parse(repository.records[0]!.at))).toBe(false);
    expect(repository.records[0]!.changes).toEqual([{ key: 'clinic.name', from: 'A', to: 'B' }]);
  });

  it('skips persistence when nothing changed', async () => {
    const { repository, service } = setup();

    await service.record({ id: 'user-1', type: 'user' }, []);

    expect(repository.records).toEqual([]);
  });

  it('clamps the requested window', async () => {
    const { repository, service } = setup();

    await service.list();
    expect(repository.lastLimit).toBe(20);

    await service.list(0);
    expect(repository.lastLimit).toBe(1);

    await service.list(5_000);
    expect(repository.lastLimit).toBe(100);

    await service.list(Number.NaN);
    expect(repository.lastLimit).toBe(20);
  });
});
