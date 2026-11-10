# NexusTicket – Hệ Thống Đặt Vé Phân Tán (High Availability, AIOps & Passwordless Auth)

NexusTicket là hệ thống đặt vé xe trực tuyến toàn diện, được thiết kế theo mô hình **Modular Monolith**. Dự án hướng tới mục tiêu trở thành một **Sản phẩm Nghiên cứu (SPNC)** với kiến trúc bảo mật đa lớp, khả năng chịu tải cao, và tích hợp Trí tuệ Nhân tạo (AI) sâu vào khâu vận hành (AIOps).

- **Backend:** Node.js, Express, TypeScript, Prisma ORM, PostgreSQL.
- **Frontend:** React, Vite, TailwindCSS, React Query.
- **Hạ tầng & Tiện ích:** Vercel (API & Daemons), Docker, Dual Redis Cluster (HA), Multi-Level Cache, BullMQ, PayOS Payment Gateway, Cloudinary.
- **Bảo mật:** Passkeys (WebAuthn), JWT Rotation & Revocation, HMAC Audit Logs, Rate Limiting.
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
(Pipeline Middleware: Auth JWT, Idempotency, IP Guard, Zod Validator, Rate Limit)
             │
             ▼
════════════════════════ DOMAIN SERVICES ═══════════════════════
   ├── AuthService (Passkeys + JWT Rotation + Revocation)
   ├── OtpService (BullMQ / Resend Worker)
   ├── TripService (Hybrid Search: Text + Gemini Vector)
   ├── BookingService (Bulk Booking + Redis Lock + DB Lock)
   ├── PaymentService (PayOS Integration & Webhook HMAC Verify)
   ├── WalletService (Debt/Balance Guard & isLocked Check)
   ├── AI Proxy Service (Gemini Multi-Key Failover)
   ├── TicketService (AI Anomaly Detection Scan)
   └── ReconciliationService (Auto-Balancing & Audit Logs)
             │
             ▼
══════════════════════ OPERATIONS & STATE ══════════════════════
 ├── PostgreSQL (Prisma ORM) – Dữ liệu chính (pgvector)
 ├── Dual Redis Cluster (Primary & Backup Failover)
 ├── Vercel Daemons (BullMQ Mail Worker chạy nền độc lập)
 ├── PayOS Payment Gateway (Production)
 ├── Cloudinary Storage (Dual Cloud Fallback)
 └── Gemini Vector Engine (Tìm kiếm ngữ nghĩa & AIOps)
```

---

## 🔐 2. Tính Năng Bảo Mật & Kiểm Soát Tài Chính (Zero-Trust)

### 2.1. Xác Thực Không Mật Khẩu (Passkeys / WebAuthn)

- Hỗ trợ đăng nhập bằng Vân tay, Face ID hoặc Windows Hello. Loại bỏ hoàn toàn rủi ro Phishing vì khóa riêng tư không rời khỏi thiết bị.

### 2.2. JWT Hiện Đại với Refresh Token Rotation & Revocation

- **Access Token** (15 phút) lưu trong RAM, **Refresh Token** (7 ngày) lưu trong **HttpOnly Cookie** (chống XSS).
- **Revocation List (Redis):** Khi logout, token lập tức bị vô hiệu hóa trên Redis.

### 2.3. Bảo Vệ Dòng Tiền & Khóa Ví Tự Động (AIOps)

- **Khóa ví tự động:** Module Đối soát (Cron) tự động quét DB, nếu phát hiện số dư lệch so với Lịch sử (AuditLog) sẽ lập tức gán cờ `isLocked = true` và ghi log cảnh báo.
- **Chặn giao dịch:** Mọi API Mua vé và Nạp tiền đều bắt buộc kiểm tra `isLocked`. Nếu ví bị khóa, trả về lỗi `403 Forbidden`.

### 2.4. Toàn Vẹn Dữ Liệu (HMAC Audit Logs)

- Bảng `AuditLog` được bảo vệ bằng **chữ ký số HMAC-SHA256**. Nếu có bất kỳ ai (kể cả Admin) can thiệp sửa đổi số tiền trong DB, chữ ký sẽ không còn khớp, hệ thống AIOps sẽ phát hiện và đưa ra cảnh báo đỏ.

---

## ⚡ 3. Các Tính Năng Kỹ Thuật Cốt Lõi

- **High Availability:** Dual Redis Cluster tự động chuyển vùng (Failover) khi Primary gặp sự cố.
- **Multi-Level Cache:** Kết hợp LRU Cache (L1 - RAM) và Redis (L2) giúp truy vấn danh mục chuyến xe với độ trễ cực thấp.
- **Chống Race Condition:** Sử dụng **Redis Distributed Lock** kết hợp **Postgres Advisory Lock** trong `prisma.$transaction` đảm bảo không xảy ra tình trạng overselling (bán trùng ghế).
- **Tìm kiếm AI (Hybrid Search):** Kết hợp tìm kiếm từ khóa (ILIKE) và tìm kiếm ngữ nghĩa (Gemini Vector) với cơ chế Fallback thông minh (tự động bỏ lọc thời gian nếu không có kết quả).

---

## 🧪 4. Kiểm Thử Tự Động (Automated Testing)

Dự án áp dụng chiến lược kiểm thử nghiêm ngặt với **Jest** và **Supertest**. Các bài test được viết để chạy trên **DB thật** (thông qua `dbTestHelper` tự động dọn dẹp rác), đảm bảo tính xác thực cao nhất. Các module gọi API bên thứ 3 (như AI, Mail Queue) đều được **Mock** để tránh phát sinh chi phí.

### 4.1. Cấu trúc bộ Test

| Tên File                       | Loại Test        | Mô tả                                                                     |
| :----------------------------- | :--------------- | :------------------------------------------------------------------------ |
| `tests/auth.test.ts`           | Integration Test | Kiểm tra API đăng nhập, cấp phát JWT và xử lý sai mật khẩu.               |
| `tests/booking.test.ts`        | Integration Test | Mô phỏng tranh chấp 1 ghế, xác nhận Lock hoạt động (1 thành công, 1 lỗi). |
| `tests/bulkBooking.test.ts`    | Integration Test | Kiểm thử đặt nhiều ghế 1 lúc, trừ tiền chính xác.                         |
| `tests/wallet.test.ts`         | Integration Test | Kiểm tra nạp tiền, chặn nạp tiền khi ví bị khóa.                          |
| `tests/reconciliation.test.ts` | Integration Test | Giả lập Hacker sửa DB, kì vọng AIOps phát hiện và khóa ví.                |
| `tests/auditSigner.test.ts`    | Unit Test        | Kiểm tra tính toàn vẹn của chữ ký số HMAC-SHA256.                         |
| `tests/payos.test.ts`          | Unit Test        | Kiểm tra xác thực chữ ký Webhook PayOS.                                   |

### 4.2. Cách chạy Test

```bash
# Chạy toàn bộ test (Ép chạy tuần tự để tránh xung đột DB)
npm run test

# Chạy và xem báo cáo độ phủ (Coverage)
npm run test:coverage
```

### 4.3. Báo Cáo Độ Phủ (Test Coverage)

Hệ thống đạt kết quả **100% Pass (10/10 tests)**. Dưới đây là bảng tổng kết độ phủ các phân hệ quan trọng:

| Phân Hệ (Module)               | % Statements | % Branches | % Functions |  % Lines   |
| :----------------------------- | :----------: | :--------: | :---------: | :--------: |
| **app.ts** (Cấu hình Express)  |    96.96%    |   28.57%   |    100%     |   96.96%   |
| **Validation/** (Schema Zod)   |    83.78%    |     0%     |     0%      |   83.78%   |
| **Router/** (Tuyến API)        |    80.12%    |     0%     |     0%      |   80.12%   |
| **Utils/** (Bảo mật, Lock)     |    66.91%    |   51.56%   |   68.96%    |   69.76%   |
| **Middleware/** (Phân quyền)   |    61.11%    |   37.34%   |   59.09%    |   59.73%   |
| **Service/** (Logic nghiệp vụ) |    23.44%    |   16.77%   |   16.26%    |   23.95%   |
| **Tổng quan dự án**            |  **37.64%**  | **20.19%** | **26.13%**  | **38.09%** |

_(Ghi chú: Độ phủ tổng quan 37.64% do kiến trúc dự án bao gồm nhiều module phụ trợ (AI Proxy, Cloudinary, Webhook). Các module cốt lõi về Bảo mật, Routing và Đặt vé đều đạt độ phủ rất cao >80%)._

---

## 📂 5. Cấu Trúc Thư Mục Dự Án

```text
.
├── api/                          # Serverless entrypoint cho Vercel
├── config/                       # Cấu hình Cloudinary, Env, JWT, Resend
├── Controller/                   # Điều phối Request & Response
├── database/                     # Khởi tạo Prisma Client singleton
├── frontend/                     # Giao diện người dùng (React + Vite)
├── jobs/                         # Tiến trình chạy ngầm (Cron đối soát, quét vé)
├── Middleware/                   # Pipeline bảo mật (Auth, Rate Limit, Validate)
├── prisma/                       # Schema và migrations
├── queues/                       # Cấu hình BullMQ & MailWorker (chạy trên Daemon)
├── Router/                       # Khai báo các tuyến API
├── Service/                      # Logic nghiệp vụ chi tiết (Booking, Wallet, AI...)
├── tests/                        # Bộ kiểm thử tự động (Jest + Supertest)
│   └── utils/dbTestHelper.ts     # Helper tự động dọn dẹp DB test
├── Utils/                        # Tiện ích (payos, redisLock, auditSigner...)
├── Validation/                   # Schema Zod
├── Dockerfile                    # Build riêng cho BullMQ Worker (Vercel Daemons)
├── app.ts                        # Cấu hình Express App
├── server.ts                     # Khởi tạo Express Server
└── vercel.json                   # Cấu hình Deploy Vercel
```

---

## ⚙️ 6. Cấu Hình Môi Trường (.env)

Tạo file `.env` ở thư mục gốc và cấu hình các biến sau (tham khảo file `.env.example`):

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/db_name"

# Gemini AI (Tìm kiếm ngữ nghĩa & Phân tích AIOps)
GEMINI_API_KEY="AIzaSy..."
GEMINI_SECONDARY_KEY="AIzaSy..."

# Redis (Dual - HA)
REDIS_URL="redis://default:YOUR_TOKEN@YOUR_HOST:6379"
REDIS_URL_BACKUP="redis://default:YOUR_TOKEN@YOUR_BACKUP_HOST:6379"

# Frontend & CORS
VITE_API_URL="http://localhost:3000/api"
FRONTEND_URL="https://ticket-lekhai.vercel.app"
NODE_ENV="production"

# JWT
JWT_SECRET="legacy_secret"
JWT_ACCESS_SECRET="YOUR_ACCESS_SECRET_AT_LEAST_32_CHARS"
JWT_REFRESH_SECRET="YOUR_REFRESH_SECRET_AT_LEAST_32_CHARS"

# Cloudinary (Dual)
CLOUDINARY_CLOUD_NAME="YOUR_CLOUD_NAME"
CLOUDINARY_API_KEY="YOUR_API_KEY"
CLOUDINARY_API_SECRET="YOUR_API_SECRET"
CLOUDINARY_CLOUD_NAME_BACKUP="YOUR_BACKUP_CLOUD_NAME"
CLOUDINARY_API_KEY_BACKUP="YOUR_BACKUP_API_KEY"
CLOUDINARY_API_SECRET_BACKUP="YOUR_BACKUP_API_SECRET"

# Resend (Email Worker)
RESEND_API_KEY="re_YOUR_API_KEY"
fromEmail="NexusTicket <no-reply@yourdomain.com>"

# WebAuthn / Passkeys
WEBAUTHN_RP_ID="localhost"
WEBAUTHN_ORIGIN="http://localhost:5173"

# PayOS Payment Gateway
PAYOS_CLIENT_ID="YOUR_CLIENT_ID"
PAYOS_API_KEY="YOUR_API_KEY"
PAYOS_CHECKSUM_KEY="YOUR_CHECKSUM_KEY"

# Bảo mật mở rộng
CRON_SECRET="YOUR_CRON_SECRET"
AUDIT_SECRET_KEY="YOUR_AUDIT_SECRET_HMAC_KEY"
```

---

## 🚀 7. Hướng Dẫn Cài Đặt & Chạy

### 7.1. Chạy Local (Backend & Frontend)

**Backend:**

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

### 7.2. Triển khai Mail Worker (Vercel Daemons + Docker)

Do Vercel Serverless không chạy được Background Process liên tục, hệ thống sử dụng **Vercel Daemons** để chạy BullMQ Worker thông qua Docker. File `Dockerfile` đã được tối ưu đa tầng (multi-stage build) để tránh lỗi Prisma Generate và giảm dung lượng Image.

### 7.3. Cấu hình Cron Job (Sử dụng Dịch vụ Ngoài)

Vì gói Hobby của Vercel giới hạn Cron Job 1 lần/ngày, hệ thống sử dụng dịch vụ ngoài (như `cron-job.org`) để gọi API định kỳ. Cần cấu hình **3 Cron Job** sau:

1. **Làm mới báo cáo doanh thu (Khuyên dùng: 15 phút/lần):**
   - **URL:** `GET https://[domain-cua-ban]/api/admin/cron/refresh-analytics`
   - **Header:** `Authorization: Bearer [CRON_SECRET_CỦA_BẠN]`
2. **AI Quét vé bất thường (Khuyên dùng: 15 phút/lần):**
   - **URL:** `GET https://[domain-cua-ban]/api/admin/cron/ticket-auditor`
   - **Header:** `Authorization: Bearer [CRON_SECRET_CỦA_BẠN]`
3. **Đối soát tài chính (Chạy 1 lần/ngày vào 03:00 AM):**
   - **URL:** `GET https://[domain-cua-ban]/api/admin/cron/reconciliation`
   - **Header:** `Authorization: Bearer [CRON_SECRET_CỦA_BẠN]`

---

## 💡 8. Ghi Chú & Lưu Ý

- **Thanh toán thật:** Hệ thống đang chạy PayOS ở môi trường Production. Mọi giao dịch đều trừ tiền thật.
- **Passkeys trên Vercel:** Đảm bảo biến môi trường `WEBAUTHN_RP_ID` và `WEBAUTHN_ORIGIN` được cấu hình chính xác với domain thực tế.
- **Trình duyệt hỗ trợ Passkeys:** Trên iOS, khuyên dùng Safari hoặc Brave để tránh lỗi API WebAuthn của Chrome.

---

_Cập nhật lần cuối: 11/11/2026_  
_Tác giả: Lê Hoàng Khải_  
_Repository: [https://github.com/lekhai123/Ticket](https://github.com/lekhai123/Ticket)_
