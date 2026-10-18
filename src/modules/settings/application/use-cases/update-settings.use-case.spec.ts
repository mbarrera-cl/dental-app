import type { SettingValue } from '../../domain/setting-definition.js';
import type { SettingsAuditEntry, SettingsAuditRecord } from '../../domain/settings-audit.js';
import { SettingsAuditRepositoryPort } from '../ports/settings-audit-repository.port.js';
import { SettingsRepositoryPort } from '../ports/settings-repository.port.js';
import { SettingsAuditService } from '../settings-audit.service.js';
import { SettingsService } from '../settings.service.js';
import { UpdateSettingsUseCase } from './update-settings.use-case.js';

class FakeSettingsRepository extends SettingsRepositoryPort {
  stored: Record<string, SettingValue> = {};

  async findAll(): Promise<Record<string, SettingValue>> {
    return { ...this.stored };
  }

  async saveMany(values: Record<string, SettingValue>): Promise<void> {
    Object.assign(this.stored, values);
  }
}

class FakeAuditRepository extends SettingsAuditRepositoryPort {
  records: SettingsAuditRecord[] = [];

  async append(record: SettingsAuditRecord): Promise<void> {
    this.records.push(record);
  }

  async list(): Promise<SettingsAuditEntry[]> {
    return [];
  }
}

describe('UpdateSettingsUseCase', () => {
  const setup = () => {
    const repository = new FakeSettingsRepository();
    const auditRepository = new FakeAuditRepository();
    const useCase = new UpdateSettingsUseCase(
      new SettingsService(repository),
      new SettingsAuditService(auditRepository),
    );

    return { repository, auditRepository, useCase };
  };

  it('delegates valid updates to the settings service', async () => {
    const { repository, useCase } = setup();

    const overview = await useCase.execute({
      values: { 'passwordPolicy.minLength': 10 },
      securityGranted: true,
    });

    expect(repository.stored).toEqual({ 'passwordPolicy.minLength': 10 });
    expect(overview.find((setting) => setting.key === 'passwordPolicy.minLength')?.value).toBe(10);
  });

  it('records the effective diff for the actor', async () => {
    const { auditRepository, useCase } = setup();

    await useCase.execute({
      values: { 'clinic.name': 'Clínica Los Andes', 'clinic.theme.mode': 'light' },
      actor: { id: 'user-1', type: 'user' },
    });

    expect(auditRepository.records).toHaveLength(1);
    expect(auditRepository.records[0]).toMatchObject({
      actorId: 'user-1',
      actorType: 'user',
      changes: [
        { key: 'clinic.name', from: 'Mi clínica', to: 'Clínica Los Andes' },
        { key: 'clinic.theme.mode', from: 'auto', to: 'light' },
      ],
    });
  });

  it('does not audit when the caller does not identify itself', async () => {
    const { auditRepository, useCase } = setup();

    await useCase.execute({ values: { 'clinic.name': 'Sin actor' } });

    expect(auditRepository.records).toEqual([]);
  });

  it('drops no-ops from the audit trail', async () => {
    const { auditRepository, useCase } = setup();

    await useCase.execute({
      values: { 'clinic.name': 'Mi clínica' },
      actor: { id: 'user-1', type: 'user' },
    });

    expect(auditRepository.records).toEqual([]);
  });

  it('rejects settings managed by their own module', async () => {
    const { repository, useCase } = setup();

    await expect(useCase.execute({ values: { 'clinic.logo.version': 2 } })).rejects.toMatchObject({
      name: 'SettingsValueInvalidError',
      details: {
        problems: [
          {
            key: 'clinic.logo.version',
            reason: 'is managed internally and cannot be edited',
          },
        ],
      },
    });
    expect(repository.stored).toEqual({});
  });

  it('rejects security-sensitive keys without the security grant', async () => {
    const { repository, useCase } = setup();

    await expect(
      useCase.execute({ values: { 'passwordPolicy.minLength': 10 } }),
    ).rejects.toMatchObject({
      name: 'SettingsSecurityUpdateForbiddenError',
      kind: 'forbidden',
      details: { keys: ['passwordPolicy.minLength'] },
    });
    expect(repository.stored).toEqual({});
  });

  it('rejects a mixed update when any security key lacks the grant', async () => {
    const { repository, useCase } = setup();

    await expect(
      useCase.execute({
        values: { 'clinic.name': 'Clínica Los Andes', 'mcp.allowWrites': true },
      }),
    ).rejects.toMatchObject({
      name: 'SettingsSecurityUpdateForbiddenError',
      details: { keys: ['mcp.allowWrites'] },
    });
    expect(repository.stored).toEqual({});
  });

  it('allows security-sensitive keys when the security grant is present', async () => {
    const { repository, useCase } = setup();

    const overview = await useCase.execute({
      values: { 'passwordPolicy.minLength': 10, 'caroIa.allowWrites': true },
      securityGranted: true,
    });

    expect(repository.stored).toEqual({
      'passwordPolicy.minLength': 10,
      'caroIa.allowWrites': true,
    });
    expect(overview.find((setting) => setting.key === 'passwordPolicy.minLength')?.value).toBe(10);
  });

  it('keeps operational updates working without the security grant', async () => {
    const { repository, useCase } = setup();

    await useCase.execute({ values: { 'quotes.ucoRate': 3500 } });

    expect(repository.stored).toEqual({ 'quotes.ucoRate': 3500 });
  });
});
