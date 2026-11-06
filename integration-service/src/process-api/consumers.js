// ============================================================
//  CAC CONSUMER - nghe su kien va lam viec cua minh
//  Chung chay SONG SONG, khong doi nhau.
// ============================================================

const systemApi = require('../system-api');
const orders = require('./orders');

async function registerAll(messaging) {

  // --- Consumer 1: TMS tao van don ---
  await messaging.consume('tms.order-created', 'order.created', async (data, event) => {
    // TODO Scenario 1: goi systemApi.createShipment(data.orderId, data.address, data.items)
    // TODO Scenario 3: luu lai eventId da xu ly de khong tao van don 2 lan
    throw new Error('TMS consumer chua duoc cai dat');
  });

  // --- Consumer 2: CRM cong diem thuong ---
  await messaging.consume('crm.order-created', 'order.created', async (data, event) => {
    // TODO Scenario 1: tinh so diem roi goi systemApi.addLoyaltyPoints()
    throw new Error('CRM consumer chua duoc cai dat');
  });

  // --- Consumer 3: tuy chon - gui thong bao cho khach ---
  // await messaging.consume('notify.order-created', 'order.created', async (data) => {
  //   console.log(`[notify] Da gui thong bao cho don ${data.orderId}`);
  // });
}

module.exports = { registerAll };
