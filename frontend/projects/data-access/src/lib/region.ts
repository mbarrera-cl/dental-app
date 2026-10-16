/**
 * The 16 Chilean regions in north-to-south order, as used by the address
 * selector. Names stay in Spanish (they are proper nouns) and are shared by
 * every language of the UI.
 */
export const REGIONS = [
  { code: 'XV', name: 'Arica y Parinacota' },
  { code: 'I', name: 'Tarapacá' },
  { code: 'II', name: 'Antofagasta' },
  { code: 'III', name: 'Atacama' },
  { code: 'IV', name: 'Coquimbo' },
  { code: 'V', name: 'Valparaíso' },
  { code: 'RM', name: 'Región Metropolitana' },
  { code: 'VI', name: "O'Higgins" },
  { code: 'VII', name: 'Maule' },
  { code: 'XVI', name: 'Ñuble' },
  { code: 'VIII', name: 'Biobío' },
  { code: 'IX', name: 'La Araucanía' },
  { code: 'XIV', name: 'Los Ríos' },
  { code: 'X', name: 'Los Lagos' },
  { code: 'XI', name: 'Aysén' },
  { code: 'XII', name: 'Magallanes' },
] as const;

export type RegionCode = (typeof REGIONS)[number]['code'];

/** Display name of a region code, or the code itself when unknown. */
export function regionName(code: string | null | undefined): string {
  if (code === null || code === undefined) {
    return '—';
  }

  return REGIONS.find((region) => region.code === code)?.name ?? code;
}
