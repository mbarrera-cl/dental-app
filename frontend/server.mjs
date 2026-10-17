import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const distRoot = resolve(process.env.DIST_ROOT ?? 'dist');
const shellRoot = join(distRoot, 'shell', 'browser');
const port = Number(process.env.PORT ?? 8080);
const apiUrl = process.env.API_URL?.trim() ?? '';
const remoteNames = new Set(['patients', 'users', 'dashboard', 'admin', 'quotes']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

function safeFile(root, pathname) {
  const decoded = decodeURIComponent(pathname);
  const target = resolve(root, `.${normalize(decoded)}`);

  return target === root || target.startsWith(`${root}${sep}`) ? target : null;
}

function sendFile(res, file, status = 200) {
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const ext = extname(file).toLowerCase();
  res.writeHead(status, {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    ...(file.endsWith('index.html') || file.endsWith('config.js')
      ? { 'Cache-Control': 'no-cache' }
      : { 'Cache-Control': 'public, max-age=31536000, immutable' }),
  });
  createReadStream(file).pipe(res);
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const pathname = url.pathname;

  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // Runtime configuration: one image can point at any API environment.
  if (pathname === '/config.js') {
    res.writeHead(200, {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    res.end(`window.__HEXA_CONFIG__ = ${JSON.stringify({ apiUrl })};\n`);
    return;
  }

  const remoteMatch = /^\/remotes\/([^/]+)(\/.*)?$/.exec(pathname);

  if (remoteMatch !== null && remoteNames.has(remoteMatch[1])) {
    const remoteRoot = join(distRoot, remoteMatch[1], 'browser');
    const file = safeFile(remoteRoot, remoteMatch[2] || '/');

    if (file !== null) {
      sendFile(res, file);
      return;
    }
  }

  const file = safeFile(shellRoot, pathname);

  if (file !== null && existsSync(file) && statSync(file).isFile()) {
    sendFile(res, file);
    return;
  }

  // Angular SPA fallback for routes such as /patients/123 or /quotes/abc.
  if (!pathname.startsWith('/remotes/')) {
    sendFile(res, join(shellRoot, 'index.html'));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}).listen(port, '0.0.0.0', () => {
  console.log(`hexa-web listening on ${port}`);
});
