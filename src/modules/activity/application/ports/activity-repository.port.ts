import type {
  ActivityEntry,
  ActivityFilter,
  ActivityPurgeFilter,
  ActivityRecord,
} from '../../domain/activity-entry.js';

/**
 * Driven port of the activity trail. The log is append-only: there is no
 * update method, and the only deletions go through the audited purge/retention
 * paths.
 */
export abstract class ActivityRepositoryPort {
  abstract append(record: ActivityRecord): Promise<void>;

  /** Newest first, keyset-paginated. */
  abstract list(filter: ActivityFilter): Promise<ActivityEntry[]>;

  abstract count(filter: ActivityPurgeFilter): Promise<number>;

  /** Deletes matching rows and returns how many were removed. */
  abstract purge(filter: ActivityPurgeFilter): Promise<number>;
}
