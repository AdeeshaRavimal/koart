/**
 * Multi-Tenant Operational & Task Management Platform
 * Server Entrypoint
 * KOart Solutions — Digital Engineering Practice
 */

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
let { handleApiRequest } = require('./server/routes');

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;
const PUBLIC_DIR = path.resolve(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

function serveStatic(req, res, pathname) {
  let safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  if (safePath === '/' || safePath === '\\') {
    safePath = '/index.html';
  }

  let filePath = path.join(PUBLIC_DIR, safePath);

  // If path has no extension and file does not exist, fallback to SPA index.html
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const indexPath = path.join(filePath, 'index.html');
    if (fs.existsSync(indexPath)) {
      filePath = indexPath;
    } else {
      // SPA Fallback
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ['.html', '.css', '.js'].includes(ext) ? 'no-cache' : 'public, max-age=86400'
    });
    res.end(content);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('500 Internal Server Error: ' + err.message);
  }
}

function handleAppRequest(req, res) {
  // CORS Pre-flight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-company-id, x-user-id'
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // API Routes
  if (pathname.startsWith('/api/')) {
    let bodyData = '';
    req.on('data', chunk => {
      bodyData += chunk;
      if (bodyData.length > 5 * 1024 * 1024) { // 5MB limit
        req.destroy();
      }
    });

    req.on('end', () => {
      let parsedBody = null;
      if (bodyData) {
        try {
          parsedBody = JSON.parse(bodyData);
        } catch (e) {
          parsedBody = null;
        }
      }

      // Hot-reload routes module in development so route additions take effect instantly
      try {
        const routesModulePath = require.resolve('./server/routes');
        delete require.cache[routesModulePath];
      } catch (e) {}

      let { handleApiRequest } = require('./server/routes');
      handleApiRequest(req, res, parsedUrl, parsedBody);
    });
    return;
  }

  // Static Assets & SPA
  serveStatic(req, res, pathname);
}

function createServer(port) {
  const server = http.createServer(handleAppRequest);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is in use, trying ${port + 1}...`);
      createServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });

  server.listen(port, () => {
    console.log('================================================================');
    console.log('  KOart Solutions — Operational & Task Management Platform');
    console.log('  Multi-Tenant SaaS Engine (Phase 1 Rollout)');
    console.log('================================================================');
    console.log(`  Local URL:        http://localhost:${port}`);
    console.log(`  REST API Root:    http://localhost:${port}/api`);
    console.log(`  Health Check:     http://localhost:${port}/api/auth/me`);
    console.log(`  Database File:    server/data/platform-db.json`);
    console.log('================================================================');
  });

  return server;
}

if (require.main === module) {
  createServer(DEFAULT_PORT);
}

module.exports = {
  createServer,
  handleAppRequest,
  serveStatic
};

