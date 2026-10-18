#!/usr/bin/env node
/**
 * Hexa — PostgreSQL logical backup.
 *
 * Runs `pg_dump --format=custom` and uploads the result to S3-compatible
 * object storage (Backblaze B2, Cloudflare R2, AWS S3, MinIO, ...) using a
 * SigV4-signed PUT. When no object storage is configured it falls back to a
 * local directory (`BACKUP_DIR`) and prunes dumps older than the retention
 * window. Every failure is reported (Resend email when configured) and the
 * process exits non-zero so Railway marks the cron run as failed.
 *
 * Designed to run as a Railway "Cron" service whose start command is
 * `node scripts/backup.mjs`. See docs/backup.md for the full runbook.
 *
 * Environment:
 *   DATABASE_URL              PostgreSQL connection string (required)
 *   BACKUP_S3_ENDPOINT        Base URL of the bucket endpoint, e.g.
 *                             https://s3.us-west-000.backblazeb2.com (optional)
 *   BACKUP_S3_REGION          SigV4 region, e.g. us-west-000 (required if S3)
 *   BACKUP_S3_BUCKET          Bucket name (required if S3)
 *   BACKUP_S3_ACCESS_KEY      Access key id (required if S3)
 *   BACKUP_S3_SECRET_KEY      Secret access key (required if S3)
 *   BACKUP_S3_PREFIX          Optional key prefix, e.g. hexa/ (default '')
 *   BACKUP_RETENTION_DAYS     Dumps older than this are deleted (local mode; default 30)
 *   BACKUP_DIR                Local fallback directory (default ./backups)
 *   RESEND_API_KEY            Resend key for failure notifications (optional)
 *   MAIL_FROM                 Verified sender for failure notifications
 *   BACKUP_NOTIFY_EMAIL       Recipient for failure notifications
 */
import { execFile } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const databaseUrl = (process.env.DATABASE_URL ?? '').trim();
if (databaseUrl === '') {
  console.error('[backup] DATABASE_URL is required');
  process.exit(2);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const dumpFileName = `hexa-${timestamp}.dump`;
const retentionDays = positiveInt(process.env.BACKUP_RETENTION_DAYS, 30);

function positiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

function hmac(key, data) {
  return createHmac('sha256', key).update(data).digest();
}

/**
 * AWS Signature Version 4 for an S3 PutObject (no query string).
 * Reference: https://docs.aws.amazon.com/IAM/latest/UserGuide/create-signed-request.html
 */
function signS3Put({ accessKey, secretKey, region, host, key, body }) {
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);

  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = ['PUT', `/${key}`, '', canonicalHeaders, signedHeaders, payloadHash].join(
    '\n',
  );

  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');

  const kDate = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { amzDate, payloadHash, authorization };
}

async function runPgDump(outputPath) {
  const args = [
    '--dbname',
    databaseUrl,
    '--format=custom',
    '--no-owner',
    '--no-privileges',
    '--file',
    outputPath,
  ];

  try {
    await execFileAsync('pg_dump', args);
  } catch (error) {
    const parts = [];
    if (error instanceof Error && error.message) parts.push(error.message);
    if (error && typeof error.stderr === 'string' && error.stderr.trim() !== '') {
      parts.push(error.stderr.trim());
    }
    if (error && typeof error.stdout === 'string' && error.stdout.trim() !== '') {
      parts.push(error.stdout.trim());
    }
    throw new Error(`pg_dump failed: ${parts.join(' — ') || 'unknown error'}`);
  }
}

async function uploadToS3(outputPath) {
  const endpoint = (process.env.BACKUP_S3_ENDPOINT ?? '').trim();
  const region = (process.env.BACKUP_S3_REGION ?? '').trim();
  const bucket = (process.env.BACKUP_S3_BUCKET ?? '').trim();
  const accessKey = (process.env.BACKUP_S3_ACCESS_KEY ?? '').trim();
  const secretKey = (process.env.BACKUP_S3_SECRET_KEY ?? '').trim();
  const prefix = (process.env.BACKUP_S3_PREFIX ?? '').trim();

  const configured = [endpoint, region, bucket, accessKey, secretKey];
  if (configured.some((value) => value !== '') && configured.some((value) => value === '')) {
    throw new Error(
      'BACKUP_S3_* must be set together (ENDPOINT, REGION, BUCKET, ACCESS_KEY, SECRET_KEY)',
    );
  }

  if (configured.every((value) => value === '')) {
    return false; // local fallback
  }

  const body = await readFile(outputPath);
  const host = new URL(endpoint).host;
  const objectKey =
    prefix.endsWith('/') || prefix === '' ? `${prefix}${dumpFileName}` : `${prefix}/${dumpFileName}`;

  const { amzDate, payloadHash, authorization } = signS3Put({
    accessKey,
    secretKey,
    region,
    host,
    key: objectKey,
    body,
  });

  const url = `${endpoint.replace(/\/$/, '')}/${bucket}/${objectKey}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Host: host,
      'Content-Type': 'application/octet-stream',
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      Authorization: authorization,
    },
    body,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`S3 upload failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  return true;
}

async function pruneLocal(dir) {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  for (const entry of await readdir(dir)) {
    if (!entry.endsWith('.dump')) continue;
    const filePath = join(dir, entry);
    const info = await stat(filePath);
    if (info.mtimeMs < cutoff) {
      await rm(filePath, { force: true });
      console.log(`[backup] pruned old dump: ${entry}`);
    }
  }
}

async function notifyFailure(message) {
  const apiKey = (process.env.RESEND_API_KEY ?? '').trim();
  const from = (process.env.MAIL_FROM ?? '').trim();
  const to = (process.env.BACKUP_NOTIFY_EMAIL ?? '').trim();

  if (apiKey === '' || from === '' || to === '') {
    return;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: '[hexa] Backup de base de datos falló',
        text: `El backup automático de Hexa falló:\n\n${message}\n\nRevisa el servicio de backup en Railway.`,
      }),
    });

    if (!response.ok) {
      console.error(`[backup] failure notification could not be sent (${response.status})`);
    }
  } catch (error) {
    console.error(`[backup] failure notification error: ${String(error)}`);
  }
}

async function main() {
  const s3Mode = (process.env.BACKUP_S3_ENDPOINT ?? '').trim() !== '';
  const tmpDir = await mkdtemp(join(tmpdir(), 'hexa-backup-'));
  let outputPath = join(tmpDir, dumpFileName);

  try {
    await runPgDump(outputPath);

    if (s3Mode) {
      await uploadToS3(outputPath);
      console.log(`[backup] uploaded ${dumpFileName} to ${process.env.BACKUP_S3_BUCKET}`);
    } else {
      const dir = (process.env.BACKUP_DIR ?? './backups').trim();
      await mkdir(dir, { recursive: true });
      const finalPath = join(dir, dumpFileName);
      await copyFile(outputPath, finalPath);
      outputPath = finalPath;
      await pruneLocal(dir);
      console.log(`[backup] wrote ${finalPath}`);
    }

    console.log('[backup] done');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[backup] FAILED: ${message}`);
    await notifyFailure(message);
    process.exitCode = 1;
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

main();
