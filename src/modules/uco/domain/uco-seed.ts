/**
 * Reference UCO catalog (Arancel UCO) — a practical subset of the common
 * dental procedures, seeded on a fresh database. Values are **referential and
 * editable**: a clinic imports its official schedule via CSV later, which
 * replaces/updates the seed.
 *
 * Chapter/name/units follow the classic UCO fee schedule structure. The
 * figures are representative (not the official ones) — see the plan.
 */
export interface SeedUcoProcedure {
  code: string;
  chapter: string;
  name: string;
  units: number;
}

export const UCO_SEED: readonly SeedUcoProcedure[] = [
  // Consulta y diagnóstico (capítulo 1)
  { code: '010001', chapter: '1', name: 'Consulta dental de urgencia', units: 1 },
  { code: '010002', chapter: '1', name: 'Consulta dental (primera vez)', units: 1.5 },
  { code: '010003', chapter: '1', name: 'Consulta de control', units: 1 },
  { code: '010004', chapter: '1', name: 'Examen clínico integral con registro', units: 2 },
  { code: '010005', chapter: '1', name: 'Radiografía periapical', units: 1 },
  { code: '010006', chapter: '1', name: 'Radiografía panorámica', units: 2 },
  { code: '010007', chapter: '1', name: 'Modelos de estudio por arco', units: 1.5 },
  { code: '010008', chapter: '1', name: 'Toma de impresión (por arco)', units: 1 },
  { code: '010009', chapter: '1', name: 'Diagnóstico y plan de tratamiento', units: 2.5 },
  // Operatoria y conservación (capítulo 2)
  { code: '020001', chapter: '2', name: 'Obturación de una superficie', units: 2 },
  { code: '020002', chapter: '2', name: 'Obturación de dos superficies', units: 3 },
  { code: '020003', chapter: '2', name: 'Obturación de tres superficies', units: 4 },
  { code: '020004', chapter: '2', name: 'Restauración con ionómero de vidrio', units: 2 },
  { code: '020005', chapter: '2', name: 'Restauración estética directa de una cara', units: 3 },
  { code: '020006', chapter: '2', name: 'Restauración estética directa de dos caras', units: 4 },
  { code: '020007', chapter: '2', name: 'Sellante de fosas y fisuras por diente', units: 1 },
  { code: '020008', chapter: '2', name: 'Profilaxis dental (limpieza)', units: 1.5 },
  { code: '020009', chapter: '2', name: 'Destartraje supragingival por arcada', units: 1.5 },
  { code: '020010', chapter: '2', name: 'Pulpotomía (curación vital)', units: 3 },
  // Endodoncia (capítulo 3)
  { code: '030001', chapter: '3', name: 'Endodoncia de incisivo', units: 6 },
  { code: '030002', chapter: '3', name: 'Endodoncia de premolar', units: 8 },
  { code: '030003', chapter: '3', name: 'Endodoncia de molar', units: 10 },
  { code: '030004', chapter: '3', name: 'Retratamiento endodóntico de incisivo', units: 8 },
  { code: '030005', chapter: '3', name: 'Retratamiento endodóntico de molar', units: 12 },
  // Periodoncia (capítulo 4)
  { code: '040001', chapter: '4', name: 'Periodoncia básica (raspaje y alisado radicular)', units: 6 },
  { code: '040002', chapter: '4', name: 'Periodoncia por sextante', units: 4 },
  { code: '040003', chapter: '4', name: 'Curetaje gingival', units: 3 },
  { code: '040004', chapter: '4', name: 'Gingivectomía', units: 4 },
  // Cirugía y exodoncia (capítulo 5)
  { code: '050001', chapter: '5', name: 'Exodoncia de diente temporal', units: 2 },
  { code: '050002', chapter: '5', name: 'Exodoncia simple de diente permanente', units: 3 },
  { code: '050003', chapter: '5', name: 'Exodoncia compleja / tercer molar', units: 5 },
  { code: '050004', chapter: '5', name: 'Biópsia de tejidos blandos', units: 4 },
  { code: '050005', chapter: '5', name: 'Drenaje de absceso', units: 3 },
  // Rehabilitación protésica (capítulo 6)
  { code: '060001', chapter: '6', name: 'Corona unitaria', units: 8 },
  { code: '060002', chapter: '6', name: 'Corona de acero preformada', units: 4 },
  { code: '060003', chapter: '6', name: 'Puente de tres unidades', units: 18 },
  { code: '060004', chapter: '6', name: 'Prótesis parcial removible por arco', units: 10 },
  { code: '060005', chapter: '6', name: 'Prótesis total (completa)', units: 20 },
  { code: '060006', chapter: '6', name: 'Rehabilitación sobre implante (corona)', units: 12 },
  // Implantes (capítulo 7)
  { code: '070001', chapter: '7', name: 'Implante unitario (cirugía)', units: 14 },
  { code: '070002', chapter: '7', name: 'Implante (componente protésico)', units: 4 },
  { code: '070003', chapter: '7', name: 'Regeneración ósea guiada', units: 10 },
  // Ortodoncia (capítulo 8)
  { code: '080001', chapter: '8', name: 'Diagnóstico ortodóncico completo', units: 4 },
  { code: '080002', chapter: '8', name: 'Tratamiento de ortodoncia por arcada (mensual)', units: 2 },
  { code: '080003', chapter: '8', name: 'Mantenedor de espacio', units: 2 },
  { code: '080004', chapter: '8', name: 'Retenedor (por arco)', units: 3 },
  // Odontopediatría (capítulo 9)
  { code: '090001', chapter: '9', name: 'Fluorización tópica profesional', units: 0.5 },
  { code: '090002', chapter: '9', name: 'Corona de acero en molar temporal', units: 3 },
  { code: '090003', chapter: '9', name: 'Tratamiento preventivo integral del paciente infantil', units: 4 },
];
