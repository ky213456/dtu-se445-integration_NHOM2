// lib.js — micro HTTP router, khong phu thuoc thu vien ngoai.
// Muc dich: chay duoc bang `node services/wms.js` ma khong can npm install.

const http = require('http');

function makeApp(serviceName) {
  const routes = [];

  const add = (method, pattern, handler) => {
    const keys = [];
    const regex = new RegExp(
      '^' + pattern.replace(/:([A-Za-z0-9_]+)/g, (_, k) => {
        keys.push(k);
        return '([^/]+)';
      }) + '/?$'
    );
    routes.push({ method, regex, keys, handler });
  };

  const app = {
    get: (p, h) => add('GET', p, h),
    post: (p, h) => add('POST', p, h),
    put: (p, h) => add('PUT', p, h),
    del: (p, h) => add('DELETE', p, h)
  };

  app.listen = (port) => {
    const server = http.createServer((req, res) => {
      const started = Date.now();
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname;

      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', async () => {
        const send = (status, payload) => {
          const text = JSON.stringify(payload, null, 2);
          res.writeHead(status, {
            'Content-Type': 'application/json; charset=utf-8',
            'X-Mock-Service': serviceName
          });
          res.end(text);
          const ms = Date.now() - started;
          console.log(`[${serviceName}] ${req.method} ${path} -> ${status} (${ms}ms)`);
        };

        // health khong can API key
        if (path === '/health') {
          return send(200, { status: 'UP', service: serviceName, time: new Date().toISOString() });
        }

        // bao mat lop trong: bat bang REQUIRE_API_KEY=true (dung tu Case study 3)
        if (process.env.REQUIRE_API_KEY === 'true') {
          const key = req.headers['x-api-key'];
          if (!key || key !== (process.env.API_KEY || 'legacy-secret-2019')) {
            return send(401, { error: 'UNAUTHORIZED', message: 'Thieu hoac sai header X-API-Key' });
          }
        }

        let parsed = {};
        if (body) {
          try {
            parsed = JSON.parse(body);
          } catch (e) {
            return send(400, { error: 'BAD_JSON', message: 'Body khong phai JSON hop le' });
          }
        }

        for (const r of routes) {
          if (r.method !== req.method) continue;
          const m = path.match(r.regex);
          if (!m) continue;
          const params = {};
          r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
          try {
            return await r.handler({ params, body: parsed, query: url.searchParams, headers: req.headers }, send);
          } catch (err) {
            console.error(`[${serviceName}] loi:`, err.message);
            return send(500, { error: 'INTERNAL_ERROR', message: err.message });
          }
        }

        send(404, { error: 'NOT_FOUND', message: `Khong co endpoint ${req.method} ${path}` });
      });
    });

    server.listen(port, '0.0.0.0', () => {
      console.log(`[${serviceName}] dang chay o cong ${port}`);
      if (process.env.REQUIRE_API_KEY === 'true') {
        console.log(`[${serviceName}] YEU CAU X-API-Key`);
      }
    });
    return server;
  };

  return app;
}

// Gia lap do tre mang cua he thong cu
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function maybeLag(envVar) {
  const ms = parseInt(process.env[envVar] || '0', 10);
  if (ms > 0) await delay(ms);
}

// Gia lap loi ngau nhien, vi du WMS_FAIL_RATE=0.3 -> 30% request tra 503
function maybeFail(envVar, send) {
  const rate = parseFloat(process.env[envVar] || '0');
  if (rate > 0 && Math.random() < rate) {
    send(503, { error: 'SERVICE_UNAVAILABLE', message: 'He thong dang qua tai, thu lai sau' });
    return true;
  }
  return false;
}

const uid = (prefix) =>
  `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1000).toString(36)}`.toUpperCase();

module.exports = { makeApp, delay, maybeLag, maybeFail, uid };
