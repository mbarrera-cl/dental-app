import type { TranslocoService } from '@jsverse/transloco';
import type { ActivityEntry } from 'data-access';

/** Human label of the actor, with sensible fallbacks for system entries. */
export function activityActorLabel(
  entry: ActivityEntry,
  translate: (key: string) => string,
): string {
  switch (entry.actor.type) {
    case 'system':
      return translate('activity.actor.system');
    case 'anonymous':
      return entry.actor.name ?? translate('activity.actor.anonymous');
    case 'apikey':
      return entry.actor.name === null
        ? translate('activity.actor.apikey')
        : `${entry.actor.name} · ${translate('activity.actor.apikey')}`;
    default:
      return entry.actor.name ?? entry.actor.email ?? translate('activity.actor.unknown');
  }
}

/**
 * Translates the stable action key; falls back to a generic sentence with the
 * module name so an action added later is still readable.
 */
export function activityActionLabel(
  entry: ActivityEntry,
  transloco: TranslocoService,
): string {
  const key = `activity.actions.${entry.action}`;
  const translated = transloco.translate(key);

  if (translated !== key) {
    return translated;
  }

  const moduleKey = `activity.modules.${entry.module}`;
  const module = transloco.translate(moduleKey);

  return transloco.translate('activity.actions.generic', {
    module: module === moduleKey ? entry.module : module,
  });
}

export function activityModuleLabel(module: string, transloco: TranslocoService): string {
  const key = `activity.modules.${module}`;
  const translated = transloco.translate(key);

  return translated === key ? module : translated;
}
