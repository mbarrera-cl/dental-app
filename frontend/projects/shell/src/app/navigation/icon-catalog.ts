import {
  lucideActivity,
  lucideBell,
  lucideBookOpen,
  lucideBuilding2,
  lucideCalendar,
  lucideChartColumn,
  lucideCircle,
  lucideCircleHelp,
  lucideCircleUser,
  lucideClipboardList,
  lucideCreditCard,
  lucideDatabase,
  lucideFileText,
  lucideFolder,
  lucideGlobe,
  lucideHeartPulse,
  lucideHouse,
  lucideInfo,
  lucideKeyRound,
  lucideLayoutDashboard,
  lucideLink,
  lucideLockKeyhole,
  lucideMail,
  lucideMapPin,
  lucidePackage,
  lucidePanelLeft,
  lucidePhone,
  lucideSettings,
  lucideShieldCheck,
  lucideSlidersHorizontal,
  lucideStar,
  lucideStethoscope,
  lucideUserRound,
  lucideUsers,
  lucideWrench,
} from '@ng-icons/lucide';

/** Shown when an entry references an icon outside the curated catalog. */
export const MENU_ICON_FALLBACK = 'lucideCircle';

/**
 * Curated lucide set exposed to the menu editor. Storing the icon *name* in
 * the database keeps the set small (bundled SVGs) while the picker stays
 * searchable; anything unknown renders the fallback.
 */
export const MENU_ICONS: Record<string, string> = {
  lucideActivity,
  lucideBell,
  lucideBookOpen,
  lucideBuilding2,
  lucideCalendar,
  lucideChartColumn,
  lucideCircle,
  lucideCircleHelp,
  lucideCircleUser,
  lucideClipboardList,
  lucideCreditCard,
  lucideDatabase,
  lucideFileText,
  lucideFolder,
  lucideGlobe,
  lucideHeartPulse,
  lucideHouse,
  lucideInfo,
  lucideKeyRound,
  lucideLayoutDashboard,
  lucideLink,
  lucideLockKeyhole,
  lucideMail,
  lucideMapPin,
  lucidePackage,
  lucidePanelLeft,
  lucidePhone,
  lucideSettings,
  lucideShieldCheck,
  lucideSlidersHorizontal,
  lucideStar,
  lucideStethoscope,
  lucideUserRound,
  lucideUsers,
  lucideWrench,
};

/** Sorted icon names, ready for the editor's picker. */
export const MENU_ICON_NAMES: readonly string[] = Object.keys(MENU_ICONS).sort();

/** Maps a stored icon name to a registered one, falling back gracefully. */
export function resolveIcon(name: string | null | undefined): string {
  return name !== null && name !== undefined && name in MENU_ICONS ? name : MENU_ICON_FALLBACK;
}
