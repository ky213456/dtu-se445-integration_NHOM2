// ============================================================
//  TANG 2 - PROCESS API
//  Day la noi chua LOGIC NGHIEP VU.
//  No goi nhieu System API o tang duoi de hoan thanh mot nghiep vu.
// ============================================================

const systemApi = require('../system-api');
const messaging = require('../messaging');
const crypto = require('crypto');

// Luu tam trong bo nho. TODO: chuyen sang PostgreSQL o CS03.
const orders = new Map();            // orderId -> don hang
const idempotencyKeys = new Map();   // key -> orderId

/**
 * Tra ton kho - luong DONG BO.
 * Khach dang doi nen phai tra ket qua ngay.
 */
async function checkStock(sku) {
  return systemApi.getStock(sku);
}

/**
 * Tao don hang - luong BAT DONG BO.
 *
 * Y tuong: kiem ton kho dong bo (nhanh), luu don, phat su kien,
 * roi TRA LOI KHACH NGAY. Cac viec con lai (tao van don, cong diem)
 * do consumer lam o phia sau.
 *
 * TODO: hoan thien ham nay - day la Scenario 1
 */
async function createOrder({ customerId, items, idempotencyKey, correlationId }) {

  // --- Buoc 1: chong trung (Scenario 3) ---
  // TODO: neu idempotencyKey da ton tai -> tra ve don cu, khong tao moi

  // --- Buoc 2: kiem ton kho dong bo ---
  // TODO: voi moi item, goi systemApi.getStock() va so sanh so luong
  //       khong du -> nem loi INSUFFICIENT_STOCK (409)

  // --- Buoc 3: luu don voi trang thai PROCESSING ---
  const orderId = 'ORD-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const order = {
    orderId,
    customerId,
    items,
    status: 'PROCESSING',
    createdAt: new Date().toISOString()
  };
  orders.set(orderId, order);
  if (idempotencyKey) idempotencyKeys.set(idempotencyKey, orderId);

  // --- Buoc 4: phat su kien roi tra loi ngay ---
  await messaging.publish('order.created', {
    orderId,
    customerId,
    items,
    address: '123 Nguyen Van Linh, Da Nang'   // TODO: lay tu request
  }, correlationId);

  return order;
}

function getOrder(orderId) {
  return orders.get(orderId) || null;
}

function updateStatus(orderId, status, extra = {}) {
  const o = orders.get(orderId);
  if (!o) return null;
  Object.assign(o, { status, updatedAt: new Date().toISOString() }, extra);
  return o;
}

function allOrders() {
  return [...orders.values()];
}

module.exports = { checkStock, createOrder, getOrder, updateStatus, allOrders };
