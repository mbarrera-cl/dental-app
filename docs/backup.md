# Backups y restauración de la base de datos

Hexa guarda fichas clínicas (datos sensibles) que por ley deben conservarse.
Un odontólogo que trabaja solo no tiene a nadie que arregle una base perdida,
así que el backup es la primera línea de defensa. Hay dos capas:

1. **PITR de Railway Postgres** (principal) — recuperación a un punto en el
   tiempo gestionada por la plataforma.
2. **Dump lógico diario** (`scripts/backup.mjs`) — un archivo portable
   (`pg_dump --format=custom`) subido a almacenamiento de objetos fuera de
   Railway, por si hay que restaurar en otra parte o salir de la plataforma.

## Capa 1 · Habilitar backups/PITR en Railway Postgres

En el panel de Railway, abre el servicio de base de datos (Postgres) y verifica
que los backups automáticos y el point-in-time recovery estén activados.
Railway los ofrece de forma gestionada; esto cubre fallos de infraestructura,
borrados accidentales de registros y despliegues fallidos.

## Capa 2 · Dump lógico programado

### 1. Configura las variables de entorno

Crea el almacenamiento (recomendado: Backblaze B2 por coste y simplicidad;
también sirven Cloudflare R2, AWS S3 o MinIO) y configura las variables del
servicio de backup:

| Variable | Ejemplo | Descripción |
|---|---|---|
| `DATABASE_URL` | `postgresql://...` | La misma URL que usa la app (ya configurada) |
| `BACKUP_S3_ENDPOINT` | `https://s3.us-west-000.backblazeb2.com` | Base del bucket (path-style) |
| `BACKUP_S3_REGION` | `us-west-000` | Región SigV4 del bucket |
| `BACKUP_S3_BUCKET` | `hexa-backups` | Nombre del bucket |
| `BACKUP_S3_ACCESS_KEY` | — | Key id de la aplicación |
| `BACKUP_S3_SECRET_KEY` | — | Secret de la aplicación |
| `BACKUP_S3_PREFIX` | `hexa/` | Prefijo opcional de las claves |
| `BACKUP_NOTIFY_EMAIL` | `tucorreo@cl.cl` | Recibe el aviso si el backup falla |
| `RESEND_API_KEY` / `MAIL_FROM` | — | Para enviar el aviso (ya usados por agenda) |

> La retención en el bucket se gestiona con una **regla de ciclo de vida**
> (lifecycle) que borra los objetos de más de 30 días. En B2: *Bucket Settings
> → Lifecycle Settings → Keep only the last version* (30 días). Así el script
> no necesita listar ni borrar objetos remotos.

### 2. Crea el servicio cron en Railway

1. En Railway, **New Service → Cron Job** apuntando al mismo repositorio.
2. Start command: `node scripts/backup.mjs`.
3. Schedule (crontab), por ejemplo diario a las 03:00 de Chile
   (`0 7 * * *` en UTC ≈ 04:00 Chile en invierno; ajusta a tu hora):
   `0 7 * * *`.
4. Añade las variables `BACKUP_*` anteriores (Railway permite compartir
   variables entre servicios).

También puedes definir el schedule por config-as-code con `deploy.cronSchedule`
en un `railway.json` del servicio de backup.

### 3. Ejecución manual

```bash
pnpm run backup
# o directamente:
node scripts/backup.mjs
```

Si las variables `BACKUP_S3_*` no están definidas, el dump queda en
`BACKUP_DIR` (por defecto `./backups`) con retención local de
`BACKUP_RETENTION_DAYS` días.

## Restauración

El dump es un archivo `pg_dump --format=custom` (`hexa-<fecha>.dump`).

```bash
# 1. Descarga el .dump del bucket (o tómalo de BACKUP_DIR)
# 2. Restaura en una base limpia (el flag -c borra los objetos antes de crearlos)
pg_restore --clean --if-exists --no-owner --no-privileges \
  --dbname "$DATABASE_URL" hexa-<fecha>.dump
```

> `--clean --if-exists` deja la base como estaba en el momento del dump.
> Restaura contra una base **vacía o descartable**; nunca sobre la base de
> producción en vivo salvo en un desastre.

## Simulacro (hazlo una vez)

1. Levanta una base temporal: `docker run -d -e POSTGRES_PASSWORD=temp -p 5434:5432 postgres:18-alpine`.
2. `pg_restore --clean --if-exists --no-owner --no-privileges --dbname postgresql://postgres:temp@localhost:5434/postgres hexa-<fecha>.dump`.
3. Verifica que las tablas (`patients`, `clinical_records`, …) tienen datos:
   `psql postgresql://postgres:temp@localhost:5434/postgres -c 'SELECT count(*) FROM patients;'`.
