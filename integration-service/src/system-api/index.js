// ============================================================
//  TANG 1 - SYSTEM API
//  Boc quanh tung he thong legacy. KHONG chua logic nghiep vu.
//  Nhiem vu duy nhat: goi he thong cu, roi DICH ten truong cua no
//  sang ten chuan cua nhom (Canonical Data Model).
// ============================================================

const axios = require('axios');

const TIMEOUT = Number(process.env.HTTP_TIMEOUT_MS || 3000);

const http = axios.create({ timeout: TIMEOUT });

// Loi chuan hoa - moi System API nem ra loi cung mot kieu
class SystemApiError extends Error {
  constructor(code, message, status = 502, details = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

// -------------------- WMS - quan ly kho --------------------

/**
 * Tra ton kho mot san pham.
 * WMS tra ve: ma_hang, ten_hang, so_luong_ton, so_luong_giu, kha_dung, kho
 * Nhom dich sang ten chuan o duoi.
 */
async function getStock(sku) {
  try {
    const { data } = await http.get(`${process.env.WMS_URL}/api/v1/wms/inventory/${sku}`);

    // TODO: doi ten truong ben phai cho khop Canonical Data Model cua nhom
    return {
      sku: data.ma_hang,
      name: data.ten_hang,
      availableStock: data.kha_dung,
      warehouseId: data.kho
    };
  } catch (err) {
    if (err.response?.status === 404) {
      throw new SystemApiError('SKU_NOT_FOUND', `Khong tim thay san pham ${sku}`, 404, { sku });
    }
    throw new SystemApiError('WMS_UNAVAILABLE', 'WMS khong phan hoi', 503, { sku });
  }
}

/**
 * Giu hang trong kho. Tra ve reservationId - PHAI LUU LAI de con hoan tac.
 */
async function reserveStock(sku, qty, orderId) {
  try {
    const { data } = await http.post(
      `${process.env.WMS_URL}/api/v1/wms/reservations`,
      { sku, qty, orderId }
    );
    return { reservationId: data.reservationId, sku: data.sku, qty: data.qty };
  } catch (err) {
    if (err.response?.status === 409) {
      const d = err.response.data;
      throw new SystemApiError('INSUFFICIENT_STOCK',
        `Khong du ton kho cho ${sku}`, 409,
        { sku, available: d?.kha_dung, requested: qty });
    }
    if (err.response?.status === 404) {
      throw new SystemApiError('SKU_NOT_FOUND', `Khong tim thay ${sku}`, 404, { sku });
    }
    throw new SystemApiError('WMS_UNAVAILABLE', 'WMS khong phan hoi', 503, { sku });
  }
}

/** Tra hang ve kho - dung cho buoc hoan tac */
async function releaseStock(reservationId) {
  try {
    const { data } = await http.delete(`${process.env.WMS_URL}/api/v1/wms/reservations/${reservationId}`);
    return data;
  } catch (err) {
    throw new SystemApiError('WMS_UNAVAILABLE', 'Khong the hoan tra ton kho', 503, { reservationId });
  }
}

// -------------------- TMS - van chuyen --------------------

/**
 * Tao van don.
 * CANH BAO: he thong TMS KHONG chong trung. Goi 2 lan cung orderId
 * se tao ra 2 van don khac nhau. Nhom phai tu chong trung o phia minh.
 */
async function createShipment(orderId, address, items) {
  try {
    const { data } = await http.post(
      `${process.env.TMS_URL}/api/v1/tms/shipments`,
      { orderId, address, items }
    );
    return {
      shipmentId: data.shipmentId,
      trackingNo: data.trackingNo,
      status: data.status
    };
  } catch (err) {
    throw new SystemApiError('TMS_UNAVAILABLE', 'TMS khong phan hoi', 503, { orderId });
  }
}

/** Huy van don - dung cho buoc hoan tac */
async function cancelShipment(shipmentId) {
  try {
    const { data } = await http.delete(`${process.env.TMS_URL}/api/v1/tms/shipments/${shipmentId}`);
    return data;
  } catch (err) {
    throw new SystemApiError('TMS_UNAVAILABLE', 'Khong the huy van don', 503, { shipmentId });
  }
}

// -------------------- CRM - khach hang --------------------

/**
 * Cong diem thuong.
 * LUU Y: gui vao ten truong la "points" nhung CRM tra ve "diem_hien_tai" va "hang_thanh_vien".
 */
async function addLoyaltyPoints(customerId, points, orderId) {
  try {
    const { data } = await http.put(
      `${process.env.CRM_URL}/api/v1/crm/customers/${customerId}/points`,
      { points, orderId }
    );
    return {
      customerId: data.customerId,
      totalPoints: data.diem_hien_tai,
      tier: data.hang_thanh_vien
    };
  } catch (err) {
    throw new SystemApiError('CRM_UNAVAILABLE', 'CRM khong phan hoi', 503, { customerId });
  }
}

// -------------------- PAYMENT - thanh toan --------------------

/** Thu tien - dat PAYMENT_ALWAYS_FAIL=true trong compose de thu duong loi */
async function charge(orderId, amount) {
  try {
    const { data } = await http.post(
      `${process.env.PAYMENT_URL}/api/v1/payments`,
      { orderId, amount }
    );
    return {
      paymentId: data.paymentId,
      status: data.status
    };
  } catch (err) {
    if (err.response?.status === 402) {
      throw new SystemApiError('PAYMENT_DECLINED', 'Thanh toan bi tu choi', 402, { orderId, amount });
    }
    throw new SystemApiError('PAYMENT_UNAVAILABLE', 'Cong thanh toan khong phan hoi', 503, { orderId });
  }
}

// -------------------- Kiem tra suc khoe 4 he thong --------------------

async function checkLegacyHealth() {
  const targets = {
    wms: process.env.WMS_URL,
    tms: process.env.TMS_URL,
    crm: process.env.CRM_URL,
    payment: process.env.PAYMENT_URL
  };
  const result = {};
  await Promise.all(Object.entries(targets).map(async ([name, url]) => {
    try {
      await http.get(`${url}/health`, { timeout: 1500 });
      result[name] = 'UP';
    } catch {
      result[name] = 'DOWN';
    }
  }));
  return result;
}

module.exports = {
  SystemApiError,
  getStock, reserveStock, releaseStock,
  createShipment, cancelShipment,
  addLoyaltyPoints, charge,
  checkLegacyHealth
};
