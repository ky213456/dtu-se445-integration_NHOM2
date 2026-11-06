// tms.js — Transportation Management System (gia lap)
// Nha cung cap: VanTaiSoft, trien khai 2016. He thong cu nhat trong he sinh thai.
// LUU Y: he thong nay KHONG chong trung. Goi 2 lan tao 2 van don.
const { makeApp, maybeLag, maybeFail, uid } = require('./lib');
const app = makeApp('mock-tms');

const shipments = new Map();

app.post('/api/v1/tms/shipments', async (req, send) => {
  await maybeLag('TMS_LATENCY_MS');
  if (maybeFail('TMS_FAIL_RATE', send)) return;

  const { orderId, address, items } = req.body;
  if (!orderId) return send(400, { code: 'ERR_NO_ORDER', msg: 'orderId la bat buoc' });

  // He thong cu: khong kiem tra trung orderId. Tao moi moi lan duoc goi.
  const id = uid('SHP');
  shipments.set(id, {
    id, orderId,
    address: address || 'Chua co dia chi',
    items: items || [],
    carrier: 'GHN',
    status: 'CREATED',
    createdAt: new Date().toISOString()
  });

  send(201, {
    shipmentId: id,
    orderId,
    carrier: 'GHN',
    trackingNo: id.replace('SHP-', 'VN'),
    status: 'CREATED'
  });
});

app.del('/api/v1/tms/shipments/:id', async (req, send) => {
  await maybeLag('TMS_LATENCY_MS');
  const s = shipments.get(req.params.id);
  if (!s) return send(404, { code: 'ERR_NOT_FOUND', msg: 'Khong tim thay van don' });
  if (s.status === 'CANCELLED') return send(200, { shipmentId: s.id, status: 'CANCELLED', msg: 'Da huy truoc do' });
  s.status = 'CANCELLED';
  send(200, { shipmentId: s.id, orderId: s.orderId, status: 'CANCELLED' });
});

app.get('/api/v1/tms/shipments/:id', async (req, send) => {
  const s = shipments.get(req.params.id);
  if (!s) return send(404, { code: 'ERR_NOT_FOUND' });
  send(200, s);
});

app.get('/api/v1/tms/_debug/shipments', (_, send) =>
  send(200, { total: shipments.size, items: [...shipments.values()] }));

app.listen(Number(process.env.PORT) || 3002);
