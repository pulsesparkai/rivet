import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { handleApiRequest } from './api';
import { handleUpgrade } from './ws';
import { exec } from 'child_process';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function getStaticDir(): string {
  return path.resolve(__dirname, '..', '..', 'static');
}

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse): void {
  const staticDir = getStaticDir();
  let filePath = req.url === '/' ? '/index.html' : req.url || '/index.html';

  if (!filePath.includes('.')) {
    filePath = '/index.html';
  }

  const safePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const fullPath = path.join(staticDir, safePath);

  if (!fullPath.startsWith(staticDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(fullPath)) {
    const indexPath = path.join(staticDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(indexPath));
      return;
    }
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = path.extname(fullPath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(fs.readFileSync(fullPath));
}

export interface ServerOptions {
  port: number;
  workspaceRoot: string;
  openBrowser: boolean;
}

export async function startServer(opts: ServerOptions): Promise<void> {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url?.startsWith('/api/')) {
      handleApiRequest(req, res, opts.workspaceRoot);
    } else {
      serveStatic(req, res);
    }
  });

  handleUpgrade(server, opts.workspaceRoot);

  return new Promise((resolve, reject) => {
    server.listen(opts.port, () => {
      if (opts.openBrowser) {
        const url = `http://localhost:${opts.port}`;
        const cmd = process.platform === 'darwin' ? 'open' :
                    process.platform === 'win32' ? 'start' : 'xdg-open';
        exec(`${cmd} ${url}`);
      }
      resolve();
    });

    server.on('error', reject);

    process.on('SIGINT', () => {
      server.close();
      process.exit(0);
    });

    // Keep the process alive
    setInterval(() => {}, 1 << 30);
  });
}
