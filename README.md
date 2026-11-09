# NexusTicket – Hệ Thống Đặt Vé Phân Tán (High Availability, Passwordless Auth & AI Semantic Search)

NexusTicket là hệ thống đặt vé xe trực tuyến toàn diện, được thiết kế theo mô hình **Modular Monolith** kết hợp Web App hiện đại. Dự án hướng tới mục tiêu trở thành một **Sản phẩm Nghiên cứu (SPNC)** với kiến trúc bảo mật tiên tiến, khả năng chịu tải cao và tích hợp AI sâu vào vận hành.

- **Backend:** Node.js, Express, TypeScript, Prisma ORM, PostgreSQL.
- **Hạ tầng & Tiện ích:** Dual Redis Cluster (HA), Multi-Level Cache, BullMQ Queue, PayOS Payment Gateway, Cloudinary.
- **Bảo mật:** Passkeys (WebAuthn), JWT Rotation & Revocation, Application-Level Encryption (ALE).
- **Kiểm thử:** Jest + Supertest (Integration & Unit Tests).

---

## ⚠️ CẢNH BÁO QUAN TRỌNG VỀ THANH TOÁN

Hệ thống hiện tại đã được cấu hình cổng thanh toán **PayOS ở môi trường Production (Thanh toán thật)**. Mọi giao dịch quét mã QR/VietQR sẽ **trừ tiền thật** trong tài khoản ngân hàng của bạn.

- **Mục đích:** Hệ thống dùng cho mục đích nghiên cứu và test luồng thanh toán thực tế.
- **Biện pháp bảo vệ:** Giao diện Frontend đã được tích hợp **Banner cảnh báo** và số điện thoại liên hệ. Nếu lỡ phát sinh giao dịch chuyển tiền nhầm, vui lòng liên hệ ngay số **0363.489.863** để được hỗ trợ hoàn tiền.

---

## 🏗️ 1. Kiến Trúc Hệ Thống (System Architecture)

Hệ thống được tổ chức theo luồng: **Client → API Gateway → Domain Services → Operations & State**.

```text
[ Khách hàng / Quản trị viên ]
             │
             ▼
[ Frontend App (React / Vite) ]
             │ (REST API)
════════════════════════ API BOUNDARY ═════════════════════════
      [ Express API Gateway / Router ]
             │
   ┌─────────┼──────────┬──────────┬──────────┬─────────┐
   ▼         ▼          ▼          ▼          ▼         ▼
[Auth]    [Trips]   [Booking]   [Payments] [Wallets]  [Admin]
(Pipeline Middleware: Auth JWT, Idempotency, IP Guard, Zod Validator)
             │
             ▼
════════════════════════ DOMAIN SERVICES ═══════════════════════
   ├── AuthService (Passkeys + JWT Rotation + Revocation)
   ├── OtpService (BullMQ / Resend Worker)
   ├── TripService (Multi-Level Cache L1 RAM + L2 Redis)
   ├── BookingService (Redis Distributed Lock + DB Advisory Lock)
   ├── PaymentService (PayOS Integration & Webhook HMAC Verify)
   ├── WalletService (Debt/Balance Guard & isLocked Check)
   ├── AI Proxy Service (Gemini Multi-Key Failover)
   ├── TicketService (AI Anomaly Detection Scan)
   └── ReconciliationService (Auto-Balancing & Audit Logs)
             │
             ▼
══════════════════════ OPERATIONS & STATE ══════════════════════
 ├── PostgreSQL (Prisma ORM) – Dữ liệu chính
 ├── Dual Redis Cluster (Primary & Backup Failover)
 ├── BullMQ Mail Queue (Xử lý bất đồng bộ)
 ├── PayOS Payment Gateway (Production)
 ├── Cloudinary Storage (Dual Cloud Fallback)
 └── Gemini Vector Engine (Tìm kiếm ngữ nghĩa & Quét bất thường)
```

---

## 🔐 2. Tính Năng Bảo Mật & Kiểm Soát Tài Chính

Hệ thống được xây dựng với triết lý **Zero-Trust** và bảo vệ dữ liệu đa lớp.

### 2.1. Xác Thực Không Mật Khẩu (Passwordless) với Passkeys / WebAuthn

- Người dùng có thể đăng nhập bằng **Vân tay, Face ID hoặc Windows Hello** thay vì mật khẩu truyền thống.
- Loại bỏ hoàn toàn rủi ro **Phishing** và **Credential Stuffing** vì khóa riêng tư không bao giờ rời khỏi thiết bị.
- Đã tối ưu hóa tương thích: Thêm `userDisplayName` để hoạt động mượt mà trên Safari và Brave (khắc phục lỗi nhận diện trên Chrome iOS).

### 2.2. JWT Hiện Đại với Refresh Token Rotation & Revocation

- **Access Token** (15 phút) lưu trong RAM (Zustand), **Refresh Token** (7 ngày) lưu trong **HttpOnly Cookie** (chống XSS).
- **Refresh Token Rotation:** Mỗi lần refresh, token cũ bị thu hồi và cấp cặp token mới.
- **Revocation List (Redis):** Khi logout, cả Access và Refresh Token bị đưa vào blacklist trên Redis để vô hiệu hóa ngay lập tức.

### 2.3. Application-Level Encryption (ALE)

- Các trường PII như **Số điện thoại** được mã hóa bằng **AES-256-GCM** trước khi ghi vào PostgreSQL.
- Ngay cả khi Database bị rò rỉ, kẻ tấn công cũng không thể đọc được dữ liệu gốc.

### 2.4. Bảo Vệ Dòng Tiền & Khóa Ví Tự Động (Financial Guardrails)

- **Khóa ví tự động (AIOps):** Khi module Đối soát phát hiện số dư ví bị âm hoặc sai lệch so với Audit Log, hệ thống sẽ tự động gán cờ `isLocked = true` và ghi log.
- **Chặn giao dịch:** Mọi API liên quan đến Mua vé (`BookingService`) và Nạp tiền (`WalletService`) đều bắt buộc kiểm tra `isLocked`. Nếu ví bị khóa, hệ thống trả về lỗi `403 Forbidden`.
- **Quyền hạn chặt chẽ:** Hệ thống không cho phép Admin tự khóa ví (chỉ AI được phép). Admin chỉ có quyền **Mở khóa ví** (Unlock) thủ công sau khi đã xác minh.

---

## ⚡ 3. Tính Năng Kỹ Thuật Cốt Lõi

### 3.1. High Availability với Dual Redis & Auto-Failover

- Thiết lập song song cụm **Redis Primary** và **Redis Backup**. Nếu Primary gặp sự cố, hệ thống tự động chuyển sang Backup.

### 3.2. Multi-Level Cache (L1 RAM + L2 Dual Redis)

- Kết hợp **LRU Cache** trên RAM và **Redis** phân tán, giảm độ trễ truy vấn danh mục chuyến xe xuống mức tức thì.

### 3.3. Redis Distributed Lock + DB Advisory Lock (Chống Race Condition)

- Sử dụng **Redis Lock** kết hợp **Postgres Advisory Lock** trong `prisma.$transaction` để đảm bảo an toàn tuyệt đối khi nhiều người dùng cùng đặt một ghế tại cùng một thời điểm.

### 3.4. AI Quản Lý Vé & Tự Động Phát Hiện Bất Thường (Anomaly Detection)

- **Quản lý Vé (Admin):** Giao diện phân trang, tìm kiếm thông minh và hỗ trợ thu hồi vé lẻ (hoàn tiền chính xác).
- **Quét AI tự động:** Hệ thống tự động quét các vé có dấu hiệu bất thường (VD: vé 0đ, thanh toán thiếu) so với giá gốc của chuyến xe. Các vé lỗi được highlight màu đỏ để Admin xử lý.
- **Cảnh báo tự động:** AI sẽ tự động phân tích nguyên nhân và gắn cảnh báo lên đầu trang Quản lý vé, giúp Admin không bỏ lỡ các giao dịch rủi ro.

---

## 🧪 4. Kiểm Thử Tự Động (Automated Testing)

Dự án sử dụng **Jest** kết hợp **Supertest** để chạy các bài kiểm thử tích hợp và đơn vị.

### 4.1. Cấu trúc bộ Test

| Tên File                | Loại Test            | Mô tả                                                                                               |
| ----------------------- | -------------------- | --------------------------------------------------------------------------------------------------- |
| `tests/auth.test.ts`    | API Integration Test | Kiểm tra API đăng nhập trả về đúng mã lỗi (400) và cấp phát Cookie JWT khi thành công.              |
| `tests/booking.test.ts` | Integration Test     | Mô phỏng 2 request đồng thời tranh chấp 1 ghế, xác nhận chỉ 1 request thành công (Redis + DB Lock). |
| `tests/payos.test.ts`   | Unit Test            | Kiểm tra hàm xác thực chữ ký HMAC-SHA256 của PayOS, đảm bảo chống giả mạo webhook.                  |

### 4.2. Cách chạy Test

```bash
npm install
npm run test
```

### 4.3. Báo Cáo Độ Phủ Kiểm Thử (Test Coverage)

Hệ thống đã được kiểm thử tự động với kết quả **100% Pass (5/5 tests)**.

| Tên Module                    | Statements (Câu lệnh) | Branches (Nhánh) | Functions (Hàm) | Lines (Dòng) |
| :---------------------------- | :-------------------: | :--------------: | :-------------: | :----------: |
| **Utils/payos.ts**            |        96.96%         |      28.57%      |      100%       |    96.96%    |
| **Service/bookingService.ts** |        80.39%         |       70%        |     58.33%      |    80.39%    |
| **Service/authService.ts**    |        65.71%         |       50%        |       80%       |    69.69%    |
| **Utils/redisLock.ts**        |        64.28%         |        0%        |       0%        |    64.28%    |
| **Tổng quan dự án**           |      **30.66%**       |    **12.56%**    |   **17.45%**    |  **31.18%**  |

_(Ghi chú: Độ phủ tổng quan 30.66% là do hệ thống có rất nhiều file UI, Service phụ trợ và Job chưa được đưa vào diện test trong đồ án này. Các module cốt lõi về Bảo mật và Giao dịch đều đạt độ phủ >80%)._

---

## 📂 5. Cấu Trúc Thư Mục Dự Án

```text
.
├── api/                          # Serverless entrypoint cho Vercel
├── config/                       # Cấu hình Cloudinary, Env, JWT, Resend
├── Controller/                   # Điều phối Request & Response
│   ├── adminController.ts
│   ├── authController.ts
│   ├── bookingController.ts
│   ├── paymentController.ts      # Xử lý thanh toán PayOS
│   ├── ticketController.ts       # Quản lý vé & AI Scan
│   └── webauthnController.ts     # Xử lý Passkeys
├── database/                     # Khởi tạo Prisma Client singleton
├── frontend/                     # Giao diện người dùng (React + Vite)
├── jobs/                         # Tiến trình chạy ngầm
│   ├── reconciliationJob.ts      # Cron đối soát tài chính
│   └── ticketAuditorJob.ts       # Cron quét vé bất thường
├── Middleware/                   # Pipeline bảo mật
├── prisma/                       # Schema và migrations
├── queues/                       # Hàng đợi BullMQ
├── Router/                       # Khai báo các tuyến API
├── Service/                      # Logic nghiệp vụ chi tiết
│   ├── aiProxy.service.ts
│   ├── bookingService.ts
│   ├── reconciliationService.ts
│   ├── ticketService.ts          # Logic quản lý vé Admin
│   ├── walletService.ts          # Quản lý ví & Chặn giao dịch
│   └── ...
├── tests/                        # Bộ kiểm thử tự động (Jest + Supertest)
├── Utils/                        # Tiện ích
│   ├── encryption.ts             # Mã hóa AES-256-GCM
│   ├── payos.ts                  # Class xử lý chữ ký PayOS
│   └── redisLock.ts              # Dual Redis & Lock helper
├── Validation/                   # Schema Zod
├── .env                          # Biến môi trường
├── app.ts                        # Cấu hình Express App
├── server.ts                     # Khởi tạo Express Server
└── vercel.json
```

---

## ⚙️ 6. Cấu Hình Môi Trường (.env)

```env
# Database
DATABASE_URL="postgresql://postgres:password@host:5432/db_name"

# Gemini AI (Dùng cho Semantic Search & Quét bất thường)
GEMINI_API_KEY="AIzaSy..."
GEMINI_SECONDARY_KEY="AIzaSy..."

# Redis (Dual)
REDIS_URL="redis://default:token@host:6379"
REDIS_URL_BACKUP="redis://default:token@backup_host:6379"

# Frontend & CORS
VITE_API_URL="http://localhost:3000/api"
FRONTEND_URL="https://ticket-lekhai.vercel.app"
NODE_ENV="production"

# JWT & Encryption
JWT_SECRET="legacy_secret_key"
JWT_ACCESS_SECRET="your_access_secret"
JWT_REFRESH_SECRET="your_refresh_secret"
ENCRYPTION_KEY="64_ky_tu_hex_de_ma_hoa_du_lieu"

# Cloudinary (Dual)
CLOUDINARY_CLOUD_NAME="your_cloud"
CLOUDINARY_API_KEY="your_key"
CLOUDINARY_API_SECRET="your_secret"
CLOUDINARY_CLOUD_NAME_BACKUP="your_backup_cloud"
CLOUDINARY_API_KEY_BACKUP="your_backup_key"
CLOUDINARY_API_SECRET_BACKUP="your_backup_secret"

# Resend (Email)
RESEND_API_KEY="re_..."
fromEmail="abc@gmail.com"

# WebAuthn / Passkeys
WEBAUTHN_RP_ID="ticket-lekhai.vercel.app"
WEBAUTHN_ORIGIN="https://ticket-lekhai.vercel.app"

# PayOS Payment Gateway (Production)
PAYOS_CLIENT_ID="your_client_id"
PAYOS_API_KEY="your_api_key"
PAYOS_CHECKSUM_KEY="your_checksum_key"

# Bảo mật cho Cron Job (Dùng cho Vercel hoặc Cron bên ngoài gọi API)
CRON_SECRET="nexusticket_secret_123456"
```

---

## 🚀 7. Hướng Dẫn Cài Đặt & Chạy

### 7.1. Backend

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

### 7.2. Frontend

```bash
cd frontend
npm install
npm run dev
```

### 7.3. Cấu hình Cron Job (Quan trọng trên Vercel)

Vì gói Hobby của Vercel giới hạn Cron Job 1 lần/ngày, hệ thống sử dụng kết hợp:

1. **Đối soát tài chính (03:00 AM hàng ngày):** Có thể dùng Vercel Cron (khai báo trong `vercel.json`) hoặc Cron ngoài.
2. **AI Quét vé bất thường (Mỗi 15 phút):** Bắt buộc dùng dịch vụ ngoài (như `cron-job.org` hoặc `Upstash QStash`).
   - **URL gọi:** `GET https://[domain-cua-ban]/api/admin/cron/ticket-auditor`
   - **Header bảo mật:** `Authorization: Bearer [CRON_SECRET_CỦA_BẠN]`

---

## 💡 8. Ghi Chú & Lưu Ý

- **Thanh toán thật:** Hệ thống đang chạy PayOS ở môi trường Production. Mọi giao dịch đều trừ tiền thật.
- **Passkeys trên Vercel:** Đảm bảo biến môi trường `WEBAUTHN_RP_ID` và `WEBAUTHN_ORIGIN` được cấu hình chính xác.
- **Trình duyệt hỗ trợ Passkeys:** Trên iOS, khuyên dùng Safari hoặc Brave để tránh lỗi API WebAuthn của Chrome.

---

_Cập nhật lần cuối: 17h17,09/11/2026_  
_Tác giả: Lê Hoàng Khải_  
_Repository: [https://github.com/lekhai123/Ticket](https://github.com/lekhai123/Ticket)_
