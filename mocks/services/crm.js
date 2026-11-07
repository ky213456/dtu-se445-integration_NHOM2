// crm.js — Customer Relationship Management (gia lap)
// Nha cung cap: noi bo tu phat trien, 2020.
const { makeApp, maybeLag, maybeFail, uid } = require('./lib');
const app = makeApp('mock-crm');

const customers = {
  'CUS-001': { id: 'CUS-001', hoTen: 'Nguyen Van An', email: 'an.nv@example.com', diem: 1250, hang: 'GOLD' },
  'CUS-002': { id: 'CUS-002', hoTen: 'Tran Thi Binh', email: 'binh.tt@example.com', diem: 320, hang: 'SILVER' },
  'CUS-003': { id: 'CUS-003', hoTen: 'Le Minh Cuong', email: 'cuong.lm@example.com', diem: 0, hang: 'MEMBER' }
};

const pointsLog = [];

app.get('/api/v1/crm/customers/:id', async (req, send) => {
  await maybeLag('CRM_LATENCY_MS');
  const c = customers[req.params.id];
  if (!c) return send(404, { error: 'CUSTOMER_NOT_FOUND', id: req.params.id });
  send(200, c);
});

app.put('/api/v1/crm/customers/:id/points', async (req, send) => {
  await maybeLag('CRM_LATENCY_MS');
  if (maybeFail('CRM_FAIL_RATE', send)) return;

  const c = customers[req.params.id];
  if (!c) return send(404, { error: 'CUSTOMER_NOT_FOUND', id: req.params.id });

  const delta = Number(req.body.points ?? req.body.diem ?? 0);
  if (!delta) return send(400, { error: 'MISSING_POINTS', message: 'Can truong points' });

  c.diem += delta;
  if (c.diem >= 1000) c.hang = 'GOLD';
  else if (c.diem >= 300) c.hang = 'SILVER';
  else c.hang = 'MEMBER';

  const entry = { id: uid('PTS'), customerId: c.id, delta, balance: c.diem, orderId: req.body.orderId || null, at: new Date().toISOString() };
  pointsLog.push(entry);
  send(200, { customerId: c.id, diem_hien_tai: c.diem, hang_thanh_vien: c.hang, giao_dich: entry.id });
});

app.get('/api/v1/crm/_debug/points-log', (_, send) =>
  send(200, { total: pointsLog.length, items: pointsLog }));

app.listen(Number(process.env.PORT) || 3003);
