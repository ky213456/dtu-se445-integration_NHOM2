// ============================================================
//  MESSAGING - ket noi RabbitMQ
//  Publisher phat su kien, Consumer nhan su kien.
//  Day la trai tim cua tich hop bat dong bo (Scenario 1 va 3).
// ============================================================

const amqp = require('amqplib');
const crypto = require('crypto');

const EXCHANGE = 'retail.events';
const DLX = 'retail.dlx';
const MAX_RETRY = 3;

let channel = null;

/** Ket noi RabbitMQ, tu thu lai neu broker chua san sang */
async function connect(retries = 10) {
  for (let i = 1; i <= retries; i++) {
    try {
      const conn = await amqp.connect(process.env.RABBITMQ_URL);
      channel = await conn.createChannel();

      // Exchange chinh va exchange chua tin nhan hong
      await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
      await channel.assertExchange(DLX, 'topic', { durable: true });

      // Hang doi chua tin nhan that bai (Scenario 3)
      await channel.assertQueue('orders.dlq', { durable: true });
      await channel.bindQueue('orders.dlq', DLX, '#');

      conn.on('close', () => { channel = null; });
      console.log('[messaging] da ket noi RabbitMQ');
      return channel;
    } catch (err) {
      console.log(`[messaging] chua ket noi duoc (lan ${i}/${retries}), thu lai sau 3s`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  throw new Error('Khong ket noi duoc RabbitMQ');
}

/** Vo su kien chuan - moi su kien deu co cac truong nay */
function makeEvent(eventType, data, correlationId) {
  return {
    eventId: crypto.randomUUID(),
    eventType,
    schemaVersion: '1.0',
    occurredAt: new Date().toISOString(),
    correlationId: correlationId || crypto.randomUUID(),
    data
  };
}

/** Phat mot su kien vao exchange */
async function publish(eventType, data, correlationId) {
  if (!channel) throw new Error('Chua ket noi RabbitMQ');
  const event = makeEvent(eventType, data, correlationId);
  channel.publish(
    EXCHANGE,
    eventType,
    Buffer.from(JSON.stringify(event)),
    { persistent: true, contentType: 'application/json' }
  );
  console.log(`[publish] ${eventType} eventId=${event.eventId}`);
  return event;
}

/**
 * Dang ky mot consumer.
 * Tu dong thu lai MAX_RETRY lan, that bai het thi day vao DLQ.
 *
 * @param queueName  ten hang doi, vi du 'tms.order-created'
 * @param routingKey khoa dinh tuyen, vi du 'order.created'
 * @param handler    async (data, event) => {}  - nem loi neu that bai
 */
async function consume(queueName, routingKey, handler) {
  if (!channel) throw new Error('Chua ket noi RabbitMQ');

  await channel.assertQueue(queueName, {
    durable: true,
    deadLetterExchange: DLX
  });
  await channel.bindQueue(queueName, EXCHANGE, routingKey);
  await channel.prefetch(1);

  channel.consume(queueName, async (msg) => {
    if (!msg) return;
    const attempt = (msg.properties.headers?.['x-attempt'] ?? 0) + 1;
    let event;

    try {
      event = JSON.parse(msg.content.toString());
    } catch {
      console.error(`[${queueName}] body khong phai JSON, day thang vao DLQ`);
      return channel.nack(msg, false, false);
    }

    // TODO Scenario 3: kiem tra eventId da xu ly chua truoc khi chay handler
    // if (daXuLy(event.eventId)) return channel.ack(msg);

    try {
      await handler(event.data, event);
      channel.ack(msg);
      console.log(`[${queueName}] xu ly xong eventId=${event.eventId}`);
    } catch (err) {
      if (attempt >= MAX_RETRY) {
        console.error(`[${queueName}] bo cuoc sau ${attempt} lan: ${err.message} -> DLQ`);
        channel.nack(msg, false, false);     // false cuoi = khong requeue -> vao DLQ
      } else {
        console.warn(`[${queueName}] that bai lan ${attempt}: ${err.message}, se thu lai`);
        channel.ack(msg);                     // go tin cu ra
        setTimeout(() => {
          channel.publish(EXCHANGE, routingKey, msg.content, {
            persistent: true,
            headers: { 'x-attempt': attempt }
          });
        }, 2000 * attempt);                   // cho lau dan: 2s, 4s
      }
    }
  });

  console.log(`[messaging] consumer san sang: ${queueName} <- ${routingKey}`);
}

/** Dem so tin nhan trong mot hang doi - dung cho Dashboard */
async function queueDepth(queueName) {
  if (!channel) return null;
  try {
    const q = await channel.checkQueue(queueName);
    return q.messageCount;
  } catch {
    return null;
  }
}

module.exports = { connect, publish, consume, queueDepth, EXCHANGE, DLX };
