#!/usr/bin/env node
/**
 * Local development supervisor for the backend + Angular microfrontends.
 *
 * The shell initialises Native Federation with every remote on boot, so it
 * must not be started until all remoteEntry.json manifests exist. This script
 * starts the backend and the remotes first, waits for them to be ready, and
 * only then starts the shell. It also keeps a small state file so a later
 * `dev:stop` can shut everything down cleanly, including orphaned children.
 */
import { execFileSync, spawn } from 'node:child_process';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEV_DIR = join(ROOT, '.dev');
const LOG_DIR = join(DEV_DIR, 'logs');
const STATE_FILE = join(DEV_DIR, 'state.json');

const SHELL = {
  name: 'shell',
  port: 4200,
  script: 'start:shell',
  kind: 'shell',
};

const REMOTES = [
  { name: 'patients', port: 4203, script: 'start:patients', kind: 'remote' },
  { name: 'users', port: 4201, script: 'start:users', kind: 'remote' },
  { name: 'dashboard', port: 4202, script: 'start:dashboard', kind: 'remote' },
  { name: 'admin', port: 4204, script: 'start:admin', kind: 'remote' },
  { name: 'quotes', port: 4205, script: 'start:quotes', kind: 'remote' },
  { name: 'agenda', port: 4206, script: 'start:agenda', kind: 'remote' },
];

const APPS = [SHELL, ...REMOTES];

const backendPort = (() => {
  const value = Number(process.env.PORT);
  return Number.isInteger(value) && value > 0 ? value : 3000;
})();

const BACKEND = { name: 'backend', port: backendPort, kind: 'backend' };

const BACKEND_TIMEOUT_MS = 60_000;
const REMOTE_TIMEOUT_MS = 240_000;
const SHELL_TIMEOUT_MS = 180_000;

const rawArgs = process.argv.slice(2);
const hasExplicitCommand = rawArgs[0] && !rawArgs[0].startsWith('-');
const command = hasExplicitCommand ? rawArgs[0] : 'start';
const commandArgs = hasExplicitCommand ? rawArgs.slice(1) : rawArgs;
const options = {
  skipBuild: false,
  force: false,
  verbose: false,
  quiet: false,
  help: false,
};

for (const arg of commandArgs) {
  switch (arg) {
    case '--skip-build':
      options.skipBuild = true;
      break;
    case '--force':
      options.force = true;
      break;
    case '--verbose':
    case '-v':
      options.verbose = true;
      break;
    case '--quiet':
      options.quiet = true;
      break;
    case '--help':
    case '-h':
      options.help = true;
      break;
    default:
      console.error(`Unknown option: ${arg}`);
      usage();
      process.exit(2);
  }
}

let activeState = null;
let buildChild = null;
let starting = false;
let shuttingDown = false;

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, text) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text);
const info = (message) => console.log(`${paint('36', '▸')} ${message}`);
const success = (message) => console.log(`${paint('32', '✓')} ${message}`);
const warning = (message) => console.warn(`${paint('33', '!')} ${message}`);
const fail = (message) => console.error(`${paint('31', '✗')} ${message}`);

if (APPS.some((app) => app.port === BACKEND.port)) {
  fail(`PORT=${BACKEND.port} conflicts with an Angular dev server port.`);
  process.exit(2);
}

const sleep = (ms) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function shortCommand(commandLine) {
  const compact = String(commandLine || 'unknown process')
    .replace(/\s+/g, ' ')
    .trim();
  return compact.length > 110 ? `${compact.slice(0, 107)}...` : compact;
}

function ensureDevDirs() {
  mkdirSync(LOG_DIR, { recursive: true });
}

function logPath(service) {
  return join(LOG_DIR, `${service.name}.log`);
}

function printLogTail(service, lines = 40) {
  try {
    const text = readFileSync(logPath(service), 'utf8');
    const tail = text.trimEnd().split('\n').slice(-lines).join('\n');
    if (!tail) return;
    console.error(
      paint('90', `\n--- ${service.name} (last ${lines} lines) ---`),
    );
    console.error(tail);
    console.error(paint('90', `--- end ${service.name} ---\n`));
  } catch {
    // The service may have failed before its log was created.
  }
}

function readState() {
  if (!existsSync(STATE_FILE)) return null;
  try {
    const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
    return state && Array.isArray(state.services) ? state : null;
  } catch {
    return null;
  }
}

function writeState(state) {
  ensureDevDirs();
  const serializable = {
    supervisorPid: state.supervisorPid,
    startedAt: state.startedAt,
    updatedAt: new Date().toISOString(),
    services: state.services.map(({ name, port, pid, kind }) => ({
      name,
      port,
      pid,
      kind,
    })),
  };
  writeFileSync(STATE_FILE, `${JSON.stringify(serializable, null, 2)}\n`);
}

function removeState() {
  try {
    rmSync(STATE_FILE, { force: true });
  } catch {
    // Nothing to clean up.
  }
}

function pidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function commandOf(pid) {
  try {
    return execFileSync('ps', ['-p', String(pid), '-o', 'command='], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function cwdOf(pid) {
  try {
    const output = execFileSync(
      'lsof',
      ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    );
    const line = output.split('\n').find((entry) => entry.startsWith('n'));
    return line ? line.slice(1) : '';
  } catch {
    return '';
  }
}

function isUnderRoot(path) {
  return Boolean(path) && (path === ROOT || path.startsWith(`${ROOT}${sep}`));
}

function isDevProcess(pid) {
  if (isUnderRoot(cwdOf(pid))) return true;
  return commandOf(pid).includes(ROOT);
}

function isSupervisor(pid) {
  if (!pidAlive(pid)) return false;
  const commandLine = commandOf(pid);
  return (
    isUnderRoot(cwdOf(pid)) && /(?:^|\s|\/)dev\.mjs(?:\s|$)/.test(commandLine)
  );
}

function listeningPids(port) {
  try {
    const output = execFileSync(
      'lsof',
      ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return [...new Set(output.split(/\s+/).filter(Boolean).map(Number))].filter(
      (pid) => Number.isInteger(pid) && pid > 0,
    );
  } catch (error) {
    if (error.status === 1) return [];
    throw new Error(
      `Could not inspect port ${port} with lsof. Install lsof or stop the process manually.`,
    );
  }
}

function childPids(pid) {
  try {
    const output = execFileSync('pgrep', ['-P', String(pid)], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output
      .split(/\s+/)
      .filter(Boolean)
      .map(Number)
      .filter((child) => Number.isInteger(child) && child > 0);
  } catch {
    return [];
  }
}

function collectTree(pid, seen = new Set()) {
  if (!pid || seen.has(pid)) return seen;
  seen.add(pid);
  for (const child of childPids(pid)) collectTree(child, seen);
  return seen;
}

function killTree(pid, signal = 'SIGTERM') {
  const pids = [...collectTree(pid)];
  for (let index = pids.length - 1; index >= 0; index -= 1) {
    try {
      process.kill(pids[index], signal);
    } catch {
      // Already gone.
    }
  }
}

async function waitUntil(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await sleep(150);
  }
  return Boolean(await predicate());
}

function devPorts() {
  return [...new Set([BACKEND.port, ...APPS.map((app) => app.port)])];
}

function allPortsFree(ports) {
  return ports.every((port) => listeningPids(port).length === 0);
}

function portConflicts(ports) {
  const conflicts = [];
  for (const port of ports) {
    for (const pid of listeningPids(port)) {
      if (!pidAlive(pid)) continue;
      conflicts.push({ port, pid, command: commandOf(pid) });
    }
  }
  return conflicts;
}

async function reclaimDevPorts({
  force = false,
  strict = false,
  quiet = false,
} = {}) {
  const ports = devPorts();
  const attempted = new Set();
  const initial = portConflicts(ports);

  for (const conflict of initial) {
    if (isDevProcess(conflict.pid) || force) {
      attempted.add(conflict.pid);
      if (!quiet) {
        warning(
          `Port :${conflict.port} was held by PID ${conflict.pid}; stopping it.`,
        );
      }
      killTree(conflict.pid, 'SIGTERM');
    }
  }

  if (attempted.size > 0) {
    await waitUntil(() => allPortsFree(ports), 6_000);
    for (const conflict of portConflicts(ports)) {
      if (attempted.has(conflict.pid) || isDevProcess(conflict.pid) || force) {
        killTree(conflict.pid, 'SIGKILL');
      }
    }
    await waitUntil(() => allPortsFree(ports), 2_000);
  }

  const remaining = portConflicts(ports);

  if (strict && remaining.length > 0) {
    const details = remaining
      .map(
        (conflict) =>
          `  :${conflict.port}  PID ${conflict.pid}  ${shortCommand(conflict.command)}`,
      )
      .join('\n');
    throw new Error(
      `Cannot start: these development ports are still in use:\n${details}\n` +
        'Stop those processes, or rerun with --force to take over the dev ports.',
    );
  }

  if (!quiet && remaining.length > 0) {
    for (const conflict of remaining) {
      warning(
        `Port :${conflict.port} is still in use by PID ${conflict.pid} ` +
          `(${shortCommand(conflict.command)}).`,
      );
    }
  }

  return remaining;
}

function spawnService(service) {
  ensureDevDirs();
  const path = logPath(service);
  writeFileSync(path, '');
  const logStream = createWriteStream(path, { flags: 'a' });
  logStream.on('error', () => {
    // A missing log file should never take the supervisor down.
  });

  const env = { ...process.env, NG_CLI_ANALYTICS: 'false' };
  delete env.PORT;

  let executable;
  let args;
  if (service.kind === 'backend') {
    executable = process.execPath;
    args = ['--env-file-if-exists=.env', 'dist/main.js'];
    env.PORT = String(service.port);
  } else {
    executable = 'pnpm';
    args = ['-C', 'frontend', 'run', service.script];
  }

  const child = spawn(executable, args, {
    cwd: ROOT,
    env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const copyStream = (stream, target) => {
    let buffer = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      logStream.write(chunk);
      if (!options.verbose) return;
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) target.write(`[${service.name}] ${line}\n`);
    });
    stream.on('end', () => {
      if (options.verbose && buffer)
        target.write(`[${service.name}] ${buffer}\n`);
      buffer = '';
    });
  };

  copyStream(child.stdout, process.stdout);
  copyStream(child.stderr, process.stderr);
  child.once('close', () => {
    setTimeout(() => logStream.end(), 100);
  });

  return child;
}

function launch(service, state) {
  const child = spawnService(service);
  service.pid = child.pid;
  service.exited = false;

  if (child.pid) {
    state.services.push(service);
    writeState(state);
  }

  let reported = false;
  const handleFailure = (message) => {
    service.exited = true;
    if (shuttingDown || starting || reported) return;
    reported = true;
    fail(message);
    printLogTail(service);
    void shutdown('service stopped', 1);
  };

  child.on('error', (error) => {
    handleFailure(`Could not start ${service.name}: ${error.message}`);
  });
  child.on('close', (code, signal) => {
    service.exited = true;
    handleFailure(
      `${service.name} stopped unexpectedly (${
        signal ? `signal ${signal}` : `exit code ${code}`
      }).`,
    );
  });

  return service;
}

async function waitForHttp(service, path, timeoutMs, label) {
  if (!service) throw new Error(`${label} was not started.`);

  const url = `http://localhost:${service.port}${path}`;
  const deadline = Date.now() + timeoutMs;
  let lastError = 'no response yet';

  while (Date.now() < deadline) {
    if (service.exited) {
      throw new Error(`${label} exited before it became ready.`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError =
        error.name === 'TimeoutError' ? 'request timed out' : error.message;
    }
    await sleep(500);
  }

  printLogTail(service);
  throw new Error(
    `${label} did not become ready at ${url} within ${Math.round(
      timeoutMs / 1_000,
    )}s (${lastError}).`,
  );
}

function runCommand(executable, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(executable, args, {
      cwd: ROOT,
      env: { ...process.env, NG_CLI_ANALYTICS: 'false' },
      stdio: 'inherit',
    });
    buildChild = child;
    child.once('error', (error) => {
      if (buildChild === child) buildChild = null;
      reject(error);
    });
    child.once('close', (code, signal) => {
      if (buildChild === child) buildChild = null;
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(
        new Error(
          `${executable} ${args.join(' ')} failed (${
            signal ? `signal ${signal}` : `exit code ${code}`
          }).`,
        ),
      );
    });
  });
}

async function stopServices(services, { quiet = false } = {}) {
  const live = (services || []).filter(
    (service) => service.pid && pidAlive(service.pid),
  );
  if (live.length === 0) return;

  if (!quiet) {
    for (const service of live) {
      console.log(`  ${service.name.padEnd(10)} :${service.port}`);
    }
  }

  for (const service of live) killTree(service.pid, 'SIGTERM');

  const stopped = await waitUntil(
    () => live.every((service) => !pidAlive(service.pid)),
    6_000,
  );

  if (!stopped) {
    for (const service of live) {
      if (pidAlive(service.pid)) killTree(service.pid, 'SIGKILL');
    }
    await waitUntil(
      () => live.every((service) => !pidAlive(service.pid)),
      2_000,
    );
  }
}

async function stopState(state, { quiet = false } = {}) {
  const supervisorPid = state?.supervisorPid;

  if (
    supervisorPid &&
    supervisorPid !== process.pid &&
    pidAlive(supervisorPid) &&
    isSupervisor(supervisorPid)
  ) {
    if (!quiet) info(`Stopping supervisor PID ${supervisorPid}...`);
    try {
      process.kill(supervisorPid, 'SIGTERM');
    } catch {
      // It may have exited between the check and the signal.
    }

    const stopped = await waitUntil(() => !pidAlive(supervisorPid), 10_000);
    if (!stopped && pidAlive(supervisorPid)) {
      warning(`Supervisor PID ${supervisorPid} did not stop; killing it.`);
      killTree(supervisorPid, 'SIGKILL');
      await waitUntil(() => !pidAlive(supervisorPid), 2_000);
    }
  }

  await stopServices(state?.services || [], { quiet });
  removeState();
}

function printReady(state, elapsedMs) {
  const port = (name) =>
    state.services.find((service) => service.name === name)?.port ??
    APPS.find((app) => app.name === name)?.port ??
    '?';

  const lines = [
    '',
    paint('32', 'Development environment ready'),
    '',
    `  Shell (open me)  http://localhost:${port('shell')}`,
    `  Patients         http://localhost:${port('patients')}`,
    `  Users            http://localhost:${port('users')}`,
    `  Dashboard        http://localhost:${port('dashboard')}`,
    `  Admin            http://localhost:${port('admin')}`,
    `  Quotes           http://localhost:${port('quotes')}`,
    `  Agenda           http://localhost:${port('agenda')}`,
    `  API              http://localhost:${BACKEND.port}`,
    `  Swagger          http://localhost:${BACKEND.port}/docs`,
    '',
    `  Logs             ${relative(ROOT, LOG_DIR)}/<service>.log`,
    '  Stop             Ctrl+C or pnpm run dev:stop',
    '',
    `  Ready in ${(elapsedMs / 1_000).toFixed(1)}s`,
    '',
  ];
  console.log(lines.join('\n'));
}

async function start() {
  starting = true;
  let state = null;

  try {
    if (!existsSync(join(ROOT, 'node_modules'))) {
      throw new Error(
        'Root dependencies are missing. Run `pnpm install` first.',
      );
    }
    if (!existsSync(join(ROOT, 'frontend/node_modules'))) {
      throw new Error(
        'Frontend dependencies are missing. Run `pnpm -C frontend install` first.',
      );
    }
    if (!existsSync(join(ROOT, '.env'))) {
      warning(
        'No .env file found; the backend will use its built-in defaults.',
      );
    }

    ensureDevDirs();

    const previous = readState();
    if (previous) {
      info('Stopping previous dev session...');
      await stopState(previous, { quiet: true });
    }

    await reclaimDevPorts({ force: options.force, strict: true });

    // Publish the supervisor before the build so a concurrent `dev:stop` can
    // also cancel a long backend build.
    state = {
      supervisorPid: process.pid,
      startedAt: new Date().toISOString(),
      services: [],
    };
    activeState = state;
    writeState(state);

    if (options.skipBuild) {
      if (!existsSync(join(ROOT, 'dist/main.js'))) {
        throw new Error(
          'dist/main.js is missing. Run once without --skip-build to build the backend.',
        );
      }
    } else {
      info('Building backend...');
      await runCommand('pnpm', ['run', 'build']);
      success('Backend built.');
      if (!existsSync(join(ROOT, 'dist/main.js'))) {
        throw new Error(
          'The backend build finished but dist/main.js is missing.',
        );
      }
    }

    rmSync(LOG_DIR, { recursive: true, force: true });
    mkdirSync(LOG_DIR, { recursive: true });

    const startedAt = Date.now();

    info(`Starting backend on :${BACKEND.port}...`);
    const backendService = { ...BACKEND };
    launch(backendService, state);

    info('Starting remotes...');
    const remoteServices = REMOTES.map((remote) =>
      launch({ ...remote }, state),
    );

    writeState(state);

    await waitForHttp(backendService, '/health', BACKEND_TIMEOUT_MS, 'Backend');
    success(`Backend ready on http://localhost:${BACKEND.port}.`);

    await Promise.all(
      remoteServices.map(async (service) => {
        await waitForHttp(
          service,
          '/remoteEntry.json',
          REMOTE_TIMEOUT_MS,
          `${capitalize(service.name)} remote`,
        );
        success(`${capitalize(service.name)} ready on :${service.port}.`);
      }),
    );

    const deadRemote = remoteServices.find((service) => service.exited);
    if (deadRemote) {
      throw new Error(`${capitalize(deadRemote.name)} stopped during startup.`);
    }

    info('Starting shell...');
    const shellService = { ...SHELL };
    launch(shellService, state);
    writeState(state);

    await waitForHttp(
      shellService,
      '/remoteEntry.json',
      SHELL_TIMEOUT_MS,
      'Shell',
    );
    success(`Shell ready on http://localhost:${SHELL.port}.`);

    const deadService = state.services.find((service) => service.exited);
    if (deadService) {
      throw new Error(
        `${capitalize(deadService.name)} stopped during startup.`,
      );
    }

    starting = false;
    printReady(state, Date.now() - startedAt);

    // Keep the supervisor alive while the services run. Child exits (after
    // startup) and OS signals trigger shutdown().
    await new Promise(() => {});
  } catch (error) {
    starting = false;
    if (shuttingDown) return;
    for (const service of state?.services || []) {
      if (service.exited) printLogTail(service);
    }
    if (state) {
      await stopServices(state.services, { quiet: true });
      removeState();
      activeState = null;
    }
    throw error;
  }
}

async function stop() {
  const state = readState();

  if (!state) {
    if (!options.quiet)
      info('No managed dev session found; checking dev ports...');
    const remaining = await reclaimDevPorts({
      force: options.force,
      strict: false,
      quiet: options.quiet,
    });
    if (!options.quiet) {
      if (remaining.length === 0) success('Dev ports are free.');
      else warning('Some dev ports are still in use.');
    }
    return;
  }

  if (!options.quiet) info('Stopping dev environment...');
  await stopState(state, { quiet: options.quiet });
  const remaining = await reclaimDevPorts({
    force: options.force,
    strict: false,
    quiet: options.quiet,
  });

  if (!options.quiet) {
    if (remaining.length === 0) success('Dev environment stopped.');
    else warning('Some dev ports are still in use.');
  }
}

async function probeHttp(port, path) {
  try {
    const response = await fetch(`http://localhost:${port}${path}`, {
      signal: AbortSignal.timeout(1_500),
    });
    if (!response.ok) return `HTTP ${response.status}`;
    return path === '/health' ? 'healthy' : 'ready';
  } catch {
    return 'unreachable';
  }
}

async function status() {
  const state = readState();

  if (!state) {
    console.log('No managed dev environment is running.');
    const busy = portConflicts(devPorts());
    if (busy.length > 0) {
      warning('Some dev ports are in use (possibly a stale session):');
      for (const conflict of busy) {
        console.log(
          `  :${conflict.port}  PID ${conflict.pid}  ${shortCommand(conflict.command)}`,
        );
      }
      console.log('Run `pnpm run dev:stop` to clean them up.');
    }
    return;
  }

  const supervisorAlive = state.supervisorPid
    ? pidAlive(state.supervisorPid)
    : false;
  console.log(
    `Supervisor: ${supervisorAlive ? 'running' : 'not running'} (PID ${
      state.supervisorPid ?? '?'
    })`,
  );
  console.log('');
  console.log('SERVICE      PORT   PROCESS   HTTP');

  for (const definition of [{ ...BACKEND }, ...APPS]) {
    const service =
      state.services.find((candidate) => candidate.name === definition.name) ??
      definition;
    const alive = Boolean(service.pid && pidAlive(service.pid));
    const path =
      definition.kind === 'backend' ? '/health' : '/remoteEntry.json';
    const http = alive ? await probeHttp(service.port, path) : 'down';
    console.log(
      `  ${definition.name.padEnd(11)} ${String(definition.port).padEnd(
        6,
      )} ${(alive ? 'running' : 'stopped').padEnd(9)} ${http}`,
    );
  }
}

async function restart() {
  await stop();
  await start();
}

async function shutdown(reason, code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log('');
  info(`Stopping development environment${reason ? ` (${reason})` : ''}...`);

  const buildPid = buildChild?.pid;
  if (buildPid && pidAlive(buildPid)) {
    killTree(buildPid, 'SIGTERM');
    const buildStopped = await waitUntil(() => !pidAlive(buildPid), 1_000);
    if (!buildStopped && pidAlive(buildPid)) {
      killTree(buildPid, 'SIGKILL');
    }
  }

  const state = activeState;
  if (state) {
    await stopServices(state.services, { quiet: false });
    removeState();
  }

  process.exit(code);
}

function usage() {
  console.log(`Usage: node scripts/dev.mjs <command> [options]

Commands:
  start      Build the backend (unless --skip-build) and start :3000 + :4200–:4206
  stop       Stop the managed dev environment and free the dev ports
  status     Show process and HTTP status for the managed dev environment
  restart    Stop, then start again

Options:
  --skip-build   Reuse the existing dist/ backend build
  --force        Take over dev ports held by processes outside this repo
  --verbose, -v  Stream service logs to the terminal (also written to .dev/logs)
  --quiet        Reduce output (mainly for stop)
  -h, --help     Show this help
`);
}

async function main() {
  if (options.help || command === 'help') {
    usage();
    return;
  }

  switch (command) {
    case 'start':
      await start();
      break;
    case 'stop':
      await stop();
      break;
    case 'status':
      await status();
      break;
    case 'restart':
      await restart();
      break;
    default:
      usage();
      throw new Error(`Unknown command: ${command}`);
  }
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    void shutdown(signal, 0);
  });
}

main().catch((error) => {
  fail(error.message);
  process.exit(1);
});
