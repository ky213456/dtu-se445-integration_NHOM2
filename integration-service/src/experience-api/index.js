// ============================================================
//  TANG 3 - EXPERIENCE API
//  Dong goi du lieu cho dung tung loai client.
//  Vi du: app dien thoai can goi nho hon web.
// ============================================================

const orders = require('../process-api/orders');
const systemApi = require('../system-api');

/** Goi du lieu gon cho app dien thoai */
async function mobileStock(sku) {
  const s = await systemApi.getStock(sku);
  return { sku: s.sku, inStock: s.availableStock > 0, qty: s.availableStock };
}

/** Tom tat trang thai he thong cho Dashboard cua CEO */
async function dashboardSummary(messaging) {
  return {
    legacySystems: await systemApi.checkLegacyHealth(),
    orders: {
      total: orders.allOrders().length,
      processing: orders.allOrders().filter(o => o.status === 'PROCESSING').length
    },
    dlqDepth: await messaging.queueDepth('orders.dlq'),
    checkedAt: new Date().toISOString()
  };
}

module.exports = { mobileStock, dashboardSummary };
