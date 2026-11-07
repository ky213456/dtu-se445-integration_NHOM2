# Hệ thống hiện có của ABC Retail

Đây là bốn hệ thống mà ABC Retail đang vận hành. Chúng do các nhà cung cấp khác nhau xây dựng, ở những thời điểm khác nhau, và **không hệ thống nào biết đến sự tồn tại của ba hệ thống còn lại**.

Việc của nhóm bạn là làm cho chúng nói chuyện được với nhau.

> **Quy tắc:** không sửa thư mục `services/` và không sửa `docker-compose.yml` trong repo này. Đây là hệ thống của khách hàng — ngoài đời bạn cũng sẽ không có quyền sửa. Bạn viết code của mình ở một repo riêng.

---

## Chạy lên

```bash
docker compose up -d
docker compose ps
```

Kiểm tra cả bốn còn sống:

```bash
bash smoke-test.sh
```

Nếu chưa cài Docker, chạy tạm bằng Node.js (cần Node 18 trở lên):

```bash
node services/wms.js &
node services/tms.js &
node services/crm.js &
node services/payment.js &
```

Tắt hết: `docker compose down`

---

## Bảng cổng

| Hệ thống | Cổng | Nhà cung cấp | Năm triển khai |
|---|---|---|---|
| WMS — quản lý kho | 3001 | Kho Viễn Software | 2018 |
| TMS — quản lý vận chuyển | 3002 | VanTaiSoft | 2016 |
| CRM — khách hàng & điểm thưởng | 3003 | Nội bộ tự phát triển | 2020 |
| Payment — cổng thanh toán | 3004 | Đối tác ngân hàng | 2021 |

Mọi hệ thống đều có `GET /health` trả về `{"status":"UP"}`.

---

## WMS — Hệ thống quản lý kho · cổng 3001

### Tra tồn kho

```
GET /api/v1/wms/inventory/{sku}
```

Ví dụ: `curl http://localhost:3001/api/v1/wms/inventory/SKU123`

```json
{
  "ma_hang": "SKU123",
  "ten_hang": "Ao thun co tron",
  "so_luong_ton": 42,
  "so_luong_giu": 3,
  "kha_dung": 39,
  "kho": "HCM-01",
  "cap_nhat_luc": "2026-09-15T01:25:05.075Z"
}
```

Không tìm thấy mã hàng → `404` với `errorCode: "SKU_NOT_FOUND"`.

### Giữ hàng

```
POST /api/v1/wms/reservations
Body: { "sku": "SKU123", "qty": 3, "orderId": "ORD-1" }
```

Thành công → `201`, trả về `reservationId`. **Giữ lại mã này** — bạn cần nó để trả hàng về kho.

Không đủ hàng → `409` với `errorCode: "INSUFFICIENT_STOCK"`.

### Trả hàng về kho

```
DELETE /api/v1/wms/reservations/{reservationId}
```

### Mã hàng có sẵn

`SKU123` (42 cái) · `SKU456` (**0 cái** — dùng để test hết hàng) · `SKU789` (7 cái) · `SKU321` (15 cái)

---

## TMS — Hệ thống vận chuyển · cổng 3002

### Tạo vận đơn

```
POST /api/v1/tms/shipments
Body: { "orderId": "ORD-1", "address": "123 Nguyen Van Linh, Da Nang", "items": [] }
```

Thành công → `201`, trả về `shipmentId` và `trackingNo`.

> ⚠️ **Ràng buộc của nhà cung cấp:** hệ thống TMS được xây dựng từ 2016 và **không kiểm tra trùng lặp**. Gọi hai lần với cùng một `orderId` sẽ tạo ra **hai vận đơn khác nhau**, và khách hàng sẽ nhận hai kiện hàng. VanTaiSoft đã xác nhận họ không có kế hoạch sửa. Nhóm bạn phải tự xử lý ở phía mình.

### Huỷ vận đơn

```
DELETE /api/v1/tms/shipments/{shipmentId}
```

### Xem vận đơn

```
GET /api/v1/tms/shipments/{shipmentId}
```

---

## CRM — Hệ thống khách hàng · cổng 3003

### Xem khách hàng

```
GET /api/v1/crm/customers/{id}
```

### Cộng điểm thưởng

```
PUT /api/v1/crm/customers/{id}/points
Body: { "points": 500, "orderId": "ORD-1" }
```

Trả về số điểm mới và hạng thành viên. Hạng tự động tính: từ 1000 điểm là GOLD, từ 300 là SILVER, dưới 300 là MEMBER.

### Khách hàng có sẵn

`CUS-001` (1250 điểm, GOLD) · `CUS-002` (320 điểm, SILVER) · `CUS-003` (0 điểm, MEMBER)

---

## Payment — Cổng thanh toán · cổng 3004

### Thu tiền

```
POST /api/v1/payments
Body: { "orderId": "ORD-1", "amount": 450000, "method": "CARD" }
```

Thành công → `201` với `paymentId` và `status: "CAPTURED"`.

Bị từ chối → `402` với `error: "PAYMENT_DECLINED"`.

### Hoàn tiền

```
POST /api/v1/payments/{paymentId}/refund
```

---

## Endpoint hỗ trợ kiểm tra

Dùng khi demo hoặc khi debug — cho phép nhìn vào bên trong hệ thống:

```
GET http://localhost:3001/api/v1/wms/_debug/reservations
GET http://localhost:3002/api/v1/tms/_debug/shipments
GET http://localhost:3003/api/v1/crm/_debug/points-log
GET http://localhost:3004/api/v1/payments/_debug/all
```

Rất hữu ích cho kịch bản Saga: gọi trước và sau khi hoàn tác để chứng minh số liệu quay về đúng trạng thái ban đầu.

---

## Dữ liệu từ hệ thống POS cũ

File `data/pos-legacy-samples.json` chứa năm mẫu dữ liệu thật xuất từ POS. Mỗi mẫu đặt tên trường một kiểu khác nhau, kiểu dữ liệu không nhất quán, có mẫu thiếu trường, có mẫu là XML.

Đây là đầu vào cho Case study 4 — ánh xạ dữ liệu bằng AI. Và nó cũng là lý do bạn cần định nghĩa Canonical Data Model ở Case study 1.

---

## Lưu ý quan trọng

**Dữ liệu nằm trong bộ nhớ.** Khởi động lại container là mọi thứ trở về trạng thái ban đầu. Đây là chủ ý — để bạn test lại nhiều lần dễ dàng.

**Gọi từ trong mạng Docker của bạn.** Nếu Integration Service của bạn chạy trong container, dùng tên `http://mock-wms:3001`, không dùng `localhost`. Mạng có tên `legacy-net`; khai báo `external: true` trong compose của bạn để nối vào.

**Tài liệu này có thể không khớp 100% với thực tế.** Nó được viết bởi nhà cung cấp cách đây vài năm và không phải lúc nào cũng được cập nhật. Hãy tự gọi thử từng endpoint và ghi lại những gì bạn quan sát được. Đây là bước đầu tiên của mọi dự án tích hợp ngoài đời.
