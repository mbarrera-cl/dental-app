import type { SettingValue } from '../../domain/setting-definition.js';
import { SettingsRepositoryPort } from '../ports/settings-repository.port.js';
import { SettingsService } from '../settings.service.js';
import { ExportSettingsUseCase } from './export-settings.use-case.js';

class FakeSettingsRepository extends SettingsRepositoryPort {
  stored: Record<string, SettingValue> = {};

  async findAll(): Promise<Record<string, SettingValue>> {
    return { ...this.stored };
  }

  async saveMany(values: Record<string, SettingValue>): Promise<void> {
    Object.assign(this.stored, values);
  }
}

describe('ExportSettingsUseCase', () => {
  it('exporta solo claves editables dentro del sobre', async () => {
    const repository = new FakeSettingsRepository();
    repository.stored = { 'clinic.name': 'Clínica Los Andes' };
    const useCase = new ExportSettingsUseCase(new SettingsService(repository));

    const envelope = await useCase.execute();

    expect(envelope.app).toBe('hexa');
    expect(envelope.version).toBe(1);
    expect(Number.isNaN(Date.parse(envelope.exportedAt))).toBe(false);
    expect(envelope.values['clinic.name']).toBe('Clínica Los Andes');
    expect(envelope.values['clinic.theme.primary']).toBe('#0284c7');
    // Managed by the clinic module: never travels in an export.
    expect(envelope.values).not.toHaveProperty('clinic.logo.version');
  });
});
