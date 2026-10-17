import { SettingsService } from '../../settings/application/settings.service.js';
import { ActivityRepositoryPort } from './ports/activity-repository.port.js';
import { ActivityRecorder, type RecordActivityInput } from './record-activity.service.js';
import { ACTIVITY_SETTINGS } from '../domain/activity-settings.js';
import type { ActivityRecord } from '../domain/activity-entry.js';

class FakeRepository extends ActivityRepositoryPort {
  records: ActivityRecord[] = [];
  fail = false;

  async append(record: ActivityRecord): Promise<void> {
    if (this.fail) {
      throw new Error('database is down');
    }

    this.records.push(record);
  }

  async list(): Promise<never[]> {
    return [];
  }

  async count(): Promise<number> {
    return 0;
  }

  async purge(): Promise<number> {
    return 0;
  }
}

function settingsWith(overrides: Record<string, boolean | number> = {}): SettingsService {
  return {
    getBoolean: async (key: string) => (overrides[key] as boolean | undefined) ?? true,
    getNumber: async (key: string) => (overrides[key] as number | undefined) ?? 0,
  } as unknown as SettingsService;
}

const mutation: RecordActivityInput = {
  actor: { id: 'user-1', type: 'user' },
  action: 'patients.create',
  module: 'patients',
  outcome: 'success',
  method: 'POST',
  path: '/patients',
  route: '/patients',
  ip: '10.0.0.1',
  userAgent: 'Mozilla/5.0',
  subject: { type: 'patient', id: null, label: 'Camila Rojas' },
};

describe('ActivityRecorder', () => {
  it('stores a mutating action with actor and context', async () => {
    const repository = new FakeRepository();
    const recorder = new ActivityRecorder(repository, settingsWith());

    await expect(recorder.record(mutation)).resolves.toBe(true);

    expect(repository.records).toHaveLength(1);
    expect(repository.records[0]).toMatchObject({
      actorId: 'user-1',
      actorType: 'user',
      action: 'patients.create',
      module: 'patients',
      outcome: 'success',
      method: 'POST',
      path: '/patients',
      ip: '10.0.0.1',
      subjectLabel: 'Camila Rojas',
    });
  });

  it('drops everything when the master switch is off', async () => {
    const repository = new FakeRepository();
    const recorder = new ActivityRecorder(
      repository,
      settingsWith({ [ACTIVITY_SETTINGS.enabled]: false }),
    );

    await expect(recorder.record(mutation)).resolves.toBe(false);
    expect(repository.records).toHaveLength(0);
  });

  it('respects the per-module toggle', async () => {
    const repository = new FakeRepository();
    const recorder = new ActivityRecorder(
      repository,
      settingsWith({ [ACTIVITY_SETTINGS.capturePatients]: false }),
    );

    await expect(recorder.record(mutation)).resolves.toBe(false);
    expect(repository.records).toHaveLength(0);
  });

  it('does not record mutations when they are disabled', async () => {
    const repository = new FakeRepository();
    const recorder = new ActivityRecorder(
      repository,
      settingsWith({ [ACTIVITY_SETTINGS.captureMutations]: false }),
    );

    await expect(recorder.record(mutation)).resolves.toBe(false);
  });

  it('records failures only while the toggle is on', async () => {
    const failure = { ...mutation, outcome: 'failure' as const, statusCode: 409 };

    const enabledRepository = new FakeRepository();
    await new ActivityRecorder(enabledRepository, settingsWith()).record(failure);
    expect(enabledRepository.records).toHaveLength(1);
    expect(enabledRepository.records[0]?.outcome).toBe('failure');

    const disabledRepository = new FakeRepository();
    await new ActivityRecorder(
      disabledRepository,
      settingsWith({ [ACTIVITY_SETTINGS.captureFailures]: false }),
    ).record(failure);
    expect(disabledRepository.records).toHaveLength(0);
  });

  it('records audited reads only while clinical reads are enabled', async () => {
    const read = { ...mutation, action: 'clinical.read', module: 'clinical', method: 'GET' };

    const enabledRepository = new FakeRepository();
    await new ActivityRecorder(enabledRepository, settingsWith()).record(read);
    expect(enabledRepository.records).toHaveLength(1);

    const disabledRepository = new FakeRepository();
    await new ActivityRecorder(
      disabledRepository,
      settingsWith({ [ACTIVITY_SETTINGS.captureClinicalReads]: false }),
    ).record(read);
    expect(disabledRepository.records).toHaveLength(0);
  });

  it('gates auth events behind their own toggle, not the mutation switch', async () => {
    const login = { ...mutation, action: 'auth.login', module: 'auth', method: 'POST' };

    const repository = new FakeRepository();
    await new ActivityRecorder(
      repository,
      settingsWith({ [ACTIVITY_SETTINGS.captureMutations]: false }),
    ).record(login);

    expect(repository.records).toHaveLength(1);
  });

  it('drops private fields when their toggles are off', async () => {
    const repository = new FakeRepository();
    const recorder = new ActivityRecorder(
      repository,
      settingsWith({
        [ACTIVITY_SETTINGS.privacyIp]: false,
        [ACTIVITY_SETTINGS.privacyUserAgent]: false,
        [ACTIVITY_SETTINGS.privacySubjectLabel]: false,
        [ACTIVITY_SETTINGS.privacyMetadata]: false,
      }),
    );

    await recorder.record({ ...mutation, metadata: { apiKeyId: 'key-1' } });

    expect(repository.records[0]).toMatchObject({
      ip: null,
      userAgent: null,
      subjectLabel: null,
      metadata: {},
    });
  });

  it('keeps only small primitive metadata', async () => {
    const repository = new FakeRepository();
    const recorder = new ActivityRecorder(
      repository,
      settingsWith({ [ACTIVITY_SETTINGS.privacyMetadata]: true }),
    );

    await recorder.record({
      ...mutation,
      metadata: {
        apiKeyId: 'key-1',
        count: 3,
        skip: { nested: true },
        long: 'x'.repeat(400),
      },
    });

    expect(repository.records[0]?.metadata).toEqual({
      apiKeyId: 'key-1',
      count: 3,
      long: `${'x'.repeat(159)}…`,
    });
  });

  it('never throws when the trail cannot be written', async () => {
    const repository = new FakeRepository();
    repository.fail = true;

    await expect(
      new ActivityRecorder(repository, settingsWith()).record(mutation),
    ).resolves.toBe(false);
  });
});
