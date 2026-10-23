import { createHash } from 'node:crypto';
import type { FichaClinica } from './ficha-clinica.entity.js';
import type { Finding } from './finding.entity.js';

/**
 * Deterministic SHA-256 seal of a clinical record: a canonical serialization
 * of the ficha sections plus its non-voided odontogram findings. Recomputing
 * this value must yield the same hash whenever the record is unchanged, so
 * the serialization below keeps a fixed key order and only includes fields
 * that are part of the clinical content.
 */
export function computeIntegrityHash(record: FichaClinica, findings: readonly Finding[]): string {
  const nonVoided = findings
    .filter((finding) => !finding.isVoided)
    .slice()
    .sort(
      (a, b) =>
        a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
    );

  const payload = {
    record: {
      patientId: record.patientId,
      categoria: record.categoria,
      embarazada: record.embarazada,
      motivoConsulta: record.motivoConsulta,
      enfermedadActual: record.enfermedadActual,
      antecedentes: record.antecedentes.toJSON(),
      signosVitales: record.signosVitales.toJSON(),
      examenEstomatognatico: record.examenEstomatognatico.toJSON(),
      indicadores: record.indicadores.toJSON(),
    },
    findings: nonVoided.map((finding) => ({
      id: finding.id,
      tooth: finding.tooth,
      surfaces: [...finding.surfaces],
      symbol: finding.symbol,
      state: finding.state,
      recesion: finding.recesion,
      movilidad: finding.movilidad,
      note: finding.note,
    })),
  };

  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
