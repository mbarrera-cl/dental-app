#!/usr/bin/env node
/**
 * Seeds the patients API with demo records (goes through the REST API, so
 * the full hexagon — validation, use cases, SQLite adapter — is exercised).
 *
 * Usage: node scripts/seed-patients.mjs [count] [baseUrl]
 *   node scripts/seed-patients.mjs 100 http://localhost:3000
 *
 * Requires a running server. Signs in as the bootstrap administrator first
 * (override with ADMIN_EMAIL / ADMIN_PASSWORD). Re-running is safe: existing
 * RUTs (409) are reported as "skipped".
 */
const count = Number.parseInt(process.argv[2] ?? '100', 10);
const baseUrl =
  process.argv[3] ?? process.env.BASE_URL ?? 'http://localhost:3000';
const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@hexa.local';
const adminPassword = process.env.ADMIN_PASSWORD ?? 'Admin123!';

/** Signs in as the administrator and returns the `Authorization` header. */
async function login() {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });

  if (!response.ok) {
    console.error(
      `Could not sign in as ${adminEmail} (${response.status}). ` +
        'Set ADMIN_EMAIL/ADMIN_PASSWORD if you changed the bootstrap admin.',
    );
    process.exit(1);
  }

  const { accessToken } = await response.json();

  return `Bearer ${accessToken}`;
}

const NOMBRES = [
  'Camila',
  'Benjamín',
  'Sofía',
  'Mateo',
  'Isidora',
  'Agustín',
  'Florencia',
  'Vicente',
  'Catalina',
  'Joaquín',
  'Antonia',
  'Sebastián',
  'Josefa',
  'Diego',
  'Valentina',
  'Tomás',
  'Emilia',
  'Lucas',
  'Trinidad',
  'Gaspar',
];

const APELLIDOS_PATERNO = [
  'González',
  'Muñoz',
  'Rojas',
  'Díaz',
  'Pérez',
  'Soto',
  'Contreras',
  'Silva',
  'Martínez',
  'Sepúlveda',
  'Morales',
  'Rodríguez',
  'López',
  'Fuentes',
  'Hernández',
];

const APELLIDOS_MATERNO = [
  'Pérez',
  'Rojas',
  'Díaz',
  'González',
  'Muñoz',
  'Soto',
  'Silva',
  'Contreras',
  'Martínez',
  'Sepúlveda',
  'Rodríguez',
  'Morales',
  'López',
  'Hernández',
  'Fuentes',
];

const ADDRESSES = [
  { region: 'RM', comuna: 'Providencia' },
  { region: 'RM', comuna: 'Ñuñoa' },
  { region: 'RM', comuna: 'Maipú' },
  { region: 'RM', comuna: 'Puente Alto' },
  { region: 'RM', comuna: 'La Florida' },
  { region: 'V', comuna: 'Valparaíso' },
  { region: 'V', comuna: 'Viña del Mar' },
  { region: 'VIII', comuna: 'Concepción' },
  { region: 'IX', comuna: 'Temuco' },
  { region: 'II', comuna: 'Antofagasta' },
  { region: 'IV', comuna: 'La Serena' },
  { region: 'X', comuna: 'Puerto Montt' },
  { region: 'VI', comuna: 'Rancagua' },
  { region: 'XIV', comuna: 'Valdivia' },
  { region: 'XII', comuna: 'Punta Arenas' },
];

const CALLES = [
  'Av. Providencia',
  'Av. Apoquindo',
  'Calle Arturo Prat',
  'Av. Alemania',
  'Calle San Martín',
  'Av. Libertad',
  'Calle Cochrane',
  'Av. Los Carrera',
];

const ISAPRES = [
  'Colmena',
  'Consalud',
  'Banmédica',
  'Cruz Blanca',
  'Nueva Masvida',
  'Esencial',
];
const TRAMOS = ['A', 'B', 'C', 'D'];
const PARENTESCOS = [
  'Madre',
  'Padre',
  'Cónyuge',
  'Hermana',
  'Hermano',
  'Hijo',
  'Hija',
  'Pareja',
];
const NOTAS = [
  'Sin alergias conocidas.',
  'Derivado por dolor molar.',
  'Control de ortodoncia cada 4 semanas.',
  'Bruxismo: se indica férula nocturna.',
  'Alergia a la penicilina.',
];

/** Módulo 11 check digit (same algorithm as the backend value object). */
function computeDv(body) {
  let sum = 0;
  let multiplier = 2;

  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);

  if (remainder === 11) return '0';
  if (remainder === 10) return 'K';
  return String(remainder);
}

/** Strips accents/diacritics so demo emails stay valid. */
function ascii(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function buildPayload(i) {
  const rutBody = String(16000000 + i * 713);
  const nombres = NOMBRES[i % NOMBRES.length];
  const apellidoPaterno = APELLIDOS_PATERNO[(i * 3) % APELLIDOS_PATERNO.length];
  const apellidoMaterno = APELLIDOS_MATERNO[(i * 7) % APELLIDOS_MATERNO.length];
  const year = 1950 + ((i * 7) % 70);
  const month = String(((i * 5) % 12) + 1).padStart(2, '0');
  const day = String(((i * 11) % 28) + 1).padStart(2, '0');

  const payload = {
    rut: `${rutBody}-${computeDv(rutBody)}`,
    nombres,
    apellidoPaterno,
    apellidoMaterno,
    fechaNacimiento: `${year}-${month}-${day}`,
    sexo: ['femenino', 'masculino', 'femenino', 'masculino', 'otro'][i % 5],
  };

  if (i % 2 === 0) {
    payload.email =
      `${ascii(nombres)}.${ascii(apellidoPaterno)}${i}@example.com`.toLowerCase();
  }

  payload.telefono = `+56 9 ${String(40000000 + i * 137).slice(-8, -4)} ${String(40000000 + i * 137).slice(-4)}`;

  if (i % 3 === 0) {
    const address = ADDRESSES[i % ADDRESSES.length];
    payload.direccion = {
      region: address.region,
      comuna: address.comuna,
      calle: CALLES[i % CALLES.length],
      numero: String(100 + ((i * 13) % 9000)),
      ...(i % 6 === 0 ? { departamento: `Depto ${1 + (i % 40)}` } : {}),
    };
  }

  payload.prevision =
    i % 3 === 0
      ? { tipo: 'ISAPRE', plan: ISAPRES[i % ISAPRES.length] }
      : { tipo: 'FONASA', tramo: TRAMOS[i % TRAMOS.length] };

  if (i % 4 === 0) {
    payload.contactoEmergencia = {
      nombre: `${NOMBRES[(i * 5) % NOMBRES.length]} ${apellidoPaterno}`,
      telefono: `+56 9 ${String(50000000 + i * 311).slice(-8)}`,
      parentesco: PARENTESCOS[i % PARENTESCOS.length],
    };
  }

  if (i % 5 === 0) {
    payload.notas = NOTAS[i % NOTAS.length];
  }

  return payload;
}

async function main() {
  const authorization = await login();
  let created = 0;
  let skipped = 0;
  const failures = [];

  for (let i = 0; i < count; i++) {
    const payload = buildPayload(i);

    const response = await fetch(`${baseUrl}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authorization },
      body: JSON.stringify(payload),
    });

    if (response.status === 201) {
      created++;
    } else if (response.status === 409) {
      skipped++;
    } else {
      failures.push({
        rut: payload.rut,
        status: response.status,
        body: await response.text(),
      });
    }
  }

  console.log(
    `Seeded ${created}/${count} patients (skipped: ${skipped}) at ${baseUrl}`,
  );

  if (failures.length > 0) {
    console.error('Failures:');
    for (const failure of failures.slice(0, 5)) {
      console.error(` - ${failure.rut} → ${failure.status} ${failure.body}`);
    }
    process.exitCode = 1;
  }
}

await main();
