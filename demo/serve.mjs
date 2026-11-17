// Serves the demo build (`npm run build:demo` -> `dist-demo/`) the way wonmor.io does: under `/demo/teletwin-web/`.
// Usage: node demo/serve.mjs [port]   (default 4321)
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASE = '/demo/teletwin-web/';
const ROOT = fileURLToPath(new URL('../dist-demo/', import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.tgs': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
};

export function startServer(port = 4321) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith(BASE)) {
      res.writeHead(302, { Location: BASE });
      res.end();
      return;
    }
    const relative = normalize(decodeURIComponent(url.pathname.slice(BASE.length))).replace(/^([/\\])+/, '');
    let file = join(ROOT, relative);
    if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) file = join(ROOT, 'index.html');
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    createReadStream(file).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(port, () => resolve(server));
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  const port = Number(process.argv[2]) || 4321;
  await startServer(port);
  console.log(`Demo: http://localhost:${port}${BASE}`);
}
