// payment.js — Cong thanh toan (gia lap)
// Dat PAYMENT_ALWAYS_FAIL=true de kiem thu Saga / giao dich bu tru.
const { makeApp, maybeLag, uid } = require('./lib');
const app = makeApp('mock-payment');

const payments = new Map();

app.post('/api/v1/payments', async (req, send) => {
  await maybeLag('PAYMENT_LATENCY_MS');

  const { orderId, amount, method } = req.body;
  if (!orderId || amount === undefined) {
    return send(400, { error: 'MISSING_FIELD', message: 'Can co orderId va amount' });
  }

  if (process.env.PAYMENT_ALWAYS_FAIL === 'true') {
    return send(402, {
      error: 'PAYMENT_DECLINED',
      orderId,
      reason: 'The bi tu choi boi ngan hang phat hanh',
      retryable: false
    });
  }

  const id = uid('PAY');
  payments.set(id, { id, orderId, amount: Number(amount), method: method || 'CARD', status: 'CAPTURED', at: new Date().toISOString() });
  send(201, { paymentId: id, orderId, amount: Number(amount), status: 'CAPTURED' });
});

app.post('/api/v1/payments/:id/refund', async (req, send) => {
  await maybeLag('PAYMENT_LATENCY_MS');
  const p = payments.get(req.params.id);
  if (!p) return send(404, { error: 'PAYMENT_NOT_FOUND' });
  if (p.status === 'REFUNDED') return send(200, { paymentId: p.id, status: 'REFUNDED', note: 'Da hoan truoc do' });
  p.status = 'REFUNDED';
  send(200, { paymentId: p.id, orderId: p.orderId, amount: p.amount, status: 'REFUNDED' });
});

app.get('/api/v1/payments/_debug/all', (_, send) =>
  send(200, { total: payments.size, items: [...payments.values()] }));

app.listen(Number(process.env.PORT) || 3004);
