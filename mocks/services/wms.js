// wms.js — Warehouse Management System (gia lap)
// He thong quan ly kho. Nha cung cap: Kho Vien Software, trien khai 2018.
const { makeApp, maybeLag, maybeFail, uid } = require('./lib');
const app = makeApp('mock-wms');

// Ton kho ban dau. Reset moi lan khoi dong lai container.
const stock = {
  SKU123: { onHand: 42, warehouse: 'HCM-01', name: 'Ao thun co tron' },
  SKU456: { onHand: 0,  warehouse: 'HCM-01', name: 'Quan jeans slim' },
  SKU789: { onHand: 7,  warehouse: 'HN-02',  name: 'Giay sneaker trang' },
  SKU321: { onHand: 15, warehouse: 'DN-01',  name: 'Balo chong nuoc' }
};

const reservations = new Map();

app.get('/api/v1/wms/inventory/:sku', async (req, send) => {
  await maybeLag('WMS_LATENCY_MS');
  if (maybeFail('WMS_FAIL_RATE', send)) return;

  const item = stock[req.params.sku];
  if (!item) return send(404, { errorCode: 'SKU_NOT_FOUND', sku: req.params.sku });

  const held = [...reservations.values()]
    .filter(r => r.sku === req.params.sku && r.status === 'HELD')
    .reduce((s, r) => s + r.qty, 0);

  send(200, {
    ma_hang: req.params.sku,
    ten_hang: item.name,
    so_luong_ton: item.onHand,
    so_luong_giu: held,
    kha_dung: item.onHand - held,
    kho: item.warehouse,
    cap_nhat_luc: new Date().toISOString()
  });
});

app.post('/api/v1/wms/reservations', async (req, send) => {
  await maybeLag('WMS_LATENCY_MS');
  if (maybeFail('WMS_FAIL_RATE', send)) return;

  const { sku, qty, orderId } = req.body;
  if (!sku || !qty) return send(400, { errorCode: 'MISSING_FIELD', message: 'Can co sku va qty' });

  const item = stock[sku];
  if (!item) return send(404, { errorCode: 'SKU_NOT_FOUND', sku });

  const held = [...reservations.values()]
    .filter(r => r.sku === sku && r.status === 'HELD')
    .reduce((s, r) => s + r.qty, 0);

  if (item.onHand - held < qty) {
    return send(409, {
      errorCode: 'INSUFFICIENT_STOCK',
      sku, kha_dung: item.onHand - held, yeu_cau: qty
    });
  }

  const id = uid('RSV');
  reservations.set(id, { id, sku, qty: Number(qty), orderId: orderId || null, status: 'HELD', at: new Date().toISOString() });
  send(201, { reservationId: id, sku, qty: Number(qty), status: 'HELD' });
});

app.del('/api/v1/wms/reservations/:id', async (req, send) => {
  await maybeLag('WMS_LATENCY_MS');
  const r = reservations.get(req.params.id);
  if (!r) return send(404, { errorCode: 'RESERVATION_NOT_FOUND', reservationId: req.params.id });
  if (r.status === 'RELEASED') return send(200, { reservationId: r.id, status: 'RELEASED', note: 'Da duoc tra truoc do' });
  r.status = 'RELEASED';
  send(200, { reservationId: r.id, sku: r.sku, qty: r.qty, status: 'RELEASED' });
});

// Endpoint phu de giang vien/sinh vien kiem tra nhanh khi demo
app.get('/api/v1/wms/_debug/reservations', (_, send) =>
  send(200, { total: reservations.size, items: [...reservations.values()] }));

app.listen(Number(process.env.PORT) || 3001);
