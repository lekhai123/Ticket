# NexusTicket – Hệ Thống Đặt Vé Phân Tán (High Availability, AIOps & Passwordless Auth)

NexusTicket là hệ thống đặt vé xe trực tuyến toàn diện, được thiết kế theo mô hình **Modular Monolith**. Dự án hướng tới mục tiêu trở thành một **Sản phẩm Nghiên cứu (SPNC)** với kiến trúc bảo mật đa lớp, khả năng chịu tải cao, và tích hợp Trí tuệ Nhân tạo (AI) sâu vào khâu vận hành (AIOps).

- **Backend:** Node.js, Express, TypeScript, Prisma ORM, PostgreSQL (`pgvector`).
- **Frontend:** React, Vite, TailwindCSS, React Query.
- **Hạ tầng & Tiện ích:** Vercel (API & Daemons), Docker, Dual Redis Cluster (HA), Multi-Level Cache, BullMQ, PayOS Payment Gateway, Cloudinary (Dual Bucket).
- **Bảo mật & Chịu lỗi:** Passkeys (WebAuthn), JWT Rotation & Revocation, AES-256-GCM Encryption, HMAC Audit Logs, Rate Limiting, Helmet, Circuit Breaker (Opossum).
- **Kiểm thử:** Jest, Playwright (E2E), k6 (Load Test).

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
(Pipeline Middleware: Auth JWT, Wallet Guard, Idempotency (SET NX), IP Guard, Zod Validator, Rate Limit, Maintenance)
             │
             ▼
════════════════════════ DOMAIN SERVICES ═══════════════════════
   ├── AuthService (Passkeys + JWT Rotation + Revocation + AES-256-GCM)
   ├── OtpService (BullMQ / Resend Worker + Brute-force Attempt Guard)
   ├── TripService (Hybrid Search: Text ILIKE + Gemini Vector pgvector)
   ├── BookingService (Per-seat Sorted Lock + DB Advisory Lock + Atomic Refund)
   ├── PaymentService (PayOS Integration + Webhook Atomic Idempotency)
   ├── WalletService (Debt/Balance Guard & isLocked Check)
   ├── AI Proxy Service (Gemini Multi-Key Failover + Circuit Breaker)
   ├── TicketService (AI Anomaly Detection Scan)
   └── ReconciliationService (Auto-Balancing & Recursive HMAC Audit Logs)
             │
             ▼
══════════════════════ OPERATIONS & STATE ══════════════════════
 ├── PostgreSQL (Prisma ORM) – Dữ liệu chính (pgvector + Partial Unique Index + Materialized View)
 ├── Dual Redis Cluster (Primary & Backup Write-through Failover)
 ├── Vercel Daemons (BullMQ Mail Worker chạy nền độc lập)
 ├── PayOS Payment Gateway (Production)
 ├── Cloudinary Storage (Dual Cloud Fallback)
 └── Gemini Vector Engine (Tìm kiếm ngữ nghĩa & AIOps)
```

---

## 🔐 2. Tính Năng Bảo Mật & Kiểm Soát Tài Chính (Zero-Trust)

### 2.1. Xác Thực Không Mật Khẩu (Passkeys / WebAuthn) & Kiến Trúc Mã Hóa Mở Rộng

- **Xác thực Passkeys:** Hỗ trợ đăng nhập bằng Vân tay, Face ID hoặc Windows Hello kèm bộ đếm `counter` chống Replay Attack. Khóa riêng tư (Private Key) được lưu giữ an toàn trong phần cứng thiết bị người dùng, loại bỏ triệt để nguy cơ Phishing và rò rỉ cơ sở dữ liệu xác thực.
- **Sẵn sàng mở rộng (Application-Level Encryption - AES-256-GCM):**
  - Mặc dù hệ thống hiện tại ưu tiên tối giản quy trình Onboarding bằng **Email OTP & Passkeys**, kiến trúc Backend và lược đồ cơ sở dữ liệu (`Users.phoneNumber`) đã được tích hợp sẵn tầng bảo mật dữ liệu nhạy cảm **ALE (Application-Level Encryption)** bằng thuật toán chuẩn quân đội **AES-256-GCM** (sử dụng 12-byte IV ngẫu nhiên và Authentication Tag 16-byte).
  - Thiết kế này chuẩn bị sẵn nền tảng để hệ thống mở rộng sang phân hệ **Vận chuyển & Ký gửi Hàng hóa (Logistics / Cargo Delivery)** hoặc tích hợp SMS OTP định danh trong tương lai mà không cần tái cấu trúc (refactor) cơ sở dữ liệu hay vi phạm các tiêu chuẩn bảo mật dữ liệu cá nhân.

### 2.2. JWT Hiện Đại với Refresh Token Rotation & Revocation

- **Access Token** (15 phút) lưu trong RAM, **Refresh Token** (7 ngày) lưu trong **HttpOnly Cookie** (chống XSS, giới hạn `path: "/api/auth"`).
- **Revocation List (Redis):** Khi logout hoặc làm mới phiên, token cũ lập tức bị đưa vào danh sách thu hồi trên Redis theo `jti`.

### 2.3. Bảo Vệ Dòng Tiền & Khóa Ví Tự Động (AIOps)

- **Khóa ví tự động:** Module Đối soát (Cron) tự động quét DB theo từng phân đoạn (Cursor Pagination), nếu phát hiện số dư lệch so với Lịch sử (`AuditLog`) sẽ lập tức gán cờ `isLocked = true`, cân bằng lại số dư chuẩn và gửi email cảnh báo.
- **Chặn giao dịch (`walletGuard`):** Mọi API Mua vé (bắt buộc thanh toán qua `WALLET`, không hỗ trợ trả sau `LATER`) và Nạp tiền nội bộ đều bắt buộc kiểm tra `isLocked` và số dư âm (`balance < 0`). Nếu ví bị khóa, trả về lỗi `403 Forbidden`.

### 2.4. Toàn Vẹn Dữ Liệu (Append-Only & HMAC Audit Logs)

- Bảng `AuditLog` được Prisma Client Extension (`$extends`) bảo vệ ở chế độ **Append-Only** (nghiêm cấm mọi lệnh `DELETE` và chỉ cho phép cập nhật cờ `isRevoked` khi thu hồi theo lô).
- Mọi bản ghi `AuditLog` đều được ký tự động bằng **chữ ký số HMAC-SHA256** (sắp xếp đệ quy các khóa JSON). Nếu có bất kỳ ai can thiệp sửa đổi số tiền trong DB, chữ ký sẽ không còn khớp, hệ thống AIOps sẽ phát hiện và đóng băng ví ngay lập tức.

### 2.5. Bảo Mật API & Header

- Tích hợp `helmet` giấu header `X-Powered-By`.
- Cấu hình `trust proxy` chống Spoofing IP qua header `X-Forwarded-For` cho Rate Limiter và IP Blacklist Guard.
- Siết chặt CORS chỉ cho phép đúng domain Frontend đã được làm sạch URL.
- Middleware `Idempotency` sử dụng lệnh nguyên tử `SET NX EX 60` của Redis để khóa trạng thái `"PROCESSING"` ngay từ đầu request, chống triệt để lỗi TOCTOU khi có 2 request trùng lặp gửi đồng thời.
- Bảo vệ 3 API Cron bằng `CRON_SECRET` (kiểm tra tồn tại biến môi trường nghiêm ngặt, chống lỗi `Bearer undefined`).

---

## ⚡ 3. Các Tính Năng Kỹ Thuật Cốt Lõi

- **Application-level High Availability:** Tự động chuyển vùng (Failover) ở tầng ứng dụng. Khi Redis Primary sập, hệ thống tự động Dual-Write (ghi song song) và Fallback sang Backup...
- **Multi-Level Cache:** Kết hợp LRU Cache (L1 - RAM, TTL 10s) và Redis (L2). Tự động Invalidate chuẩn xác các key chi tiết và phân trang (`trips:all:active*`) bằng `SCAN` khi có biến động đặt/hủy/thu hồi vé.
- **Chống Race Condition Đa Tầng:**
  - **Đặt vé:** Sử dụng **Redis Distributed Lock** (Lua Script) kết hợp **Postgres Advisory Lock** (`pg_advisory_xact_lock`) khóa theo **TỪNG GHẾ** (Per-seat Lock) và chốt chặn cuối bằng **Partial Unique Index** (`tickets_active_seat_unique`) dưới PostgreSQL. Tự động sắp xếp thứ tự ghế tăng dần (`sortedSeats`) để chống Deadlock và tự động nhả các khóa đã giữ nếu 1 ghế trong lô bị xung đột.
  - **Hủy vé / Thu hồi vé / Webhook PayOS:** Chống **Double Refund** (hoàn tiền 2 lần) và **Double Top-up** (cộng tiền 2 lần) bằng kỹ thuật Atomic Conditional Update (`updateMany` kèm điều kiện trạng thái `status: "CONFIRMED"` hoặc `status: "PENDING"`) bên trong Database Transaction.
- **Tìm kiếm AI (Hybrid Search):** Kết hợp tìm kiếm từ khóa (`ILIKE`), bộ lọc khung giờ thông minh (sáng/chiều/tối) và tìm kiếm ngữ nghĩa (Gemini Vector `pgvector` 1536 chiều) với cơ chế Fallback tự động mở rộng kết quả.
- **Báo cáo Doanh thu Hiệu năng cao:** Sử dụng PostgreSQL **Materialized View** (`revenue_stats`) kèm Unique Index giúp làm mới dữ liệu thống kê ngầm bằng lệnh `REFRESH MATERIALIZED VIEW CONCURRENTLY` mà không gây khóa bảng khi người dùng đang truy vấn.

### 3.5. Cầu Dao Điện (Circuit Breaker) & Chịu Lỗi

- **Circuit Breaker (Opossum):** Tích hợp cho các dịch vụ bên thứ 3 (Gemini AI, PayOS). Nếu dịch vụ sập liên tục, mạch sẽ ngắt (Open) và trả về Fallback ngay lập tức (0ms) thay vì bắt khách hàng chờ timeout.
- **Graceful Degradation & Shutdown:** Nếu AI sập, tính năng tìm kiếm tự động chuyển về tìm kiếm Text (`ILIKE`) cơ bản. Khi tắt Server (`SIGTERM`/`SIGINT`), hệ thống tự động đóng kết nối HTTP, Prisma, Redis và BullMQ Worker an toàn.

### 3.6. Chế Độ Bảo Trì Khẩn Cấp (Emergency Maintenance)

- Admin có thể bật/tắt chế độ bảo trì 1-Click từ trang **System Health** (tự động mở lại sau 15 phút).
- Khi bật, hệ thống chặn mọi thao tác ghi/giao dịch (`POST`/`PUT`/`PATCH`/`DELETE` trả về lỗi `503`), nhưng vẫn cho phép các truy vấn chỉ đọc (`GET`) và làm mới phiên đăng nhập để khách hàng xem được vé và số dư ví.
- **Đặc biệt:** Webhook PayOS vẫn được xuyên qua để cộng tiền nếu khách đã lỡ chuyển khoản.

---

## 🧪 4. Hệ Thống Kiểm Thử Toàn Diện (Automated Testing)

Dự án áp dụng chiến lược kiểm thử đa tầng (Unit, Integration, E2E, Load Test) để đảm bảo tính ổn định và an toàn cho hệ thống.

### 4.1. Cấu trúc bộ Test

| Tên File / Công cụ                     | Loại Test          | Mô tả                                                                                 |
| :------------------------------------- | :----------------- | :------------------------------------------------------------------------------------ |
| `tests/*.test.ts` (Jest)               | Unit & Integration | Test API, Database Transaction, HMAC Signature, chạy trên DB thật với helper dọn dẹp. |
| `e2e-tests/flows.spec.ts` (Playwright) | E2E Test           | Tự động mở trình duyệt, giả lập người dùng Đăng nhập -> Search -> Mua vé -> Hủy vé.   |
| `load-test.js` (k6)                    | Load Test          | Giả lập 50 người dùng đồng thời (CCU) spam mua 1 ghế để test Redis Lock & chịu tải.   |

### 4.2. Cách chạy Test

**1. Chạy Unit & Integration Test (Jest):**

```bash
npm run test
npm run test:coverage
```

**2. Chạy E2E Test (Playwright):**

```bash
cd e2e-tests
npx playwright test --headed
```

**3. Chạy Load Test (k6):**

```bash
k6 run load-test.js
```

### 4.3. Báo Cáo Độ Phủ (Jest Coverage)

Hệ thống đạt kết quả **100% Pass** ở tất cả các bộ test. Đặc biệt, **100% các luồng nghiệp vụ cốt lõi (Core Business Logic)** liên quan đến tài chính và giao dịch đều được kiểm thử tự động (Integration Test):

- `auth.test.ts`: Đăng nhập, phân quyền.
- `wallet.test.ts` & `payos.test.ts`: Nạp tiền, thanh toán, chống giả mạo webhook.
- `booking.test.ts` & `bulkBooking.test.ts`: Đặt vé đơn, đặt vé hàng loạt, chống Race Condition.
- `reconciliation.test.ts`: AIOps đối soát số dư và khóa ví.
- `auditSigner.test.ts`: Chống can thiệp dữ liệu (HMAC).

| Phân Hệ (Module)              | % Statements | % Branches | % Functions |  % Lines   |
| :---------------------------- | :----------: | :--------: | :---------: | :--------: |
| **app.ts** (Cấu hình Express) |    96.96%    |   28.57%   |    100%     |   96.96%   |
| **Validation/** (Schema Zod)  |    83.78%    |     0%     |     0%      |   83.78%   |
| **Router/** (Tuyến API)       |    80.12%    |     0%     |     0%      |   80.12%   |
| **Utils/** (Bảo mật, Lock)    |    66.91%    |   51.56%   |   68.96%    |   69.76%   |
| **Middleware/** (Phân quyền)  |    61.11%    |   37.34%   |   59.09%    |   59.73%   |
| **Tổng quan dự án**           |  **37.64%**  | **20.19%** | **26.13%**  | **38.09%** |

_(Tổng quan độ phủ toàn dự án đạt ~38%, tập trung chủ yếu vào các file Utils và Middleware)._

### 4.4. Kết Quả Load Test (k6 - Production Vercel)

Hệ thống đã được kiểm thử tải trực tiếp trên môi trường Production (Vercel Serverless) với **50 Virtual Users (CCU)** liên tục trong 1 phút 40 giây.

- **Tỷ lệ lỗi Server (500):** `0.00%` (Hệ thống hoàn toàn không bị sập).
- **Thời gian phản hồi (p95):** `1.26s` (Đạt chuẩn).
- **Tổng số request xử lý:** `2017 requests` (~19 req/s).
- **Điểm sáng:** Cơ chế **Redis Distributed Lock** đã chặn đứng thành công **1007 requests** mua trùng ghế, chỉ cho phép đúng **1 request** mua thành công.

---

## 📂 5. Cấu Trúc Thư Mục Dự Án

```text
.
├── api/                          # Serverless entrypoint cho Vercel
├── config/                       # Cấu hình Cloudinary, Env, JWT, Resend
├── Controller/                   # Điều phối Request & Response
├── database/                     # Khởi tạo Prisma Client singleton + AuditLog Extension
├── e2e-tests/                    # Bộ test E2E với Playwright
├── frontend/                     # Giao diện người dùng (React + Vite)
├── jobs/                         # Tiến trình chạy ngầm (Cron đối soát, quét vé, doanh thu)
├── Middleware/                   # Pipeline bảo mật (Auth, WalletGuard, Rate Limit, Maintenance...)
├── prisma/                       # Schema và lịch sử Migrations (Partial Index, Materialized View)
├── queues/                       # Cấu hình BullMQ & MailWorker (chạy trên Daemon)
├── Router/                       # Khai báo các tuyến API
├── Service/                      # Logic nghiệp vụ chi tiết (Booking, Wallet, AI, Reconciliation...)
├── tests/                        # Bộ kiểm thử tự động (Jest + Supertest)
│   └── utils/dbTestHelper.ts     # Helper tự động dọn dẹp DB test
├── Utils/                        # Tiện ích (payos, redisLock, auditSigner, encryption...)
├── Validation/                   # Schema Zod (Auth, Booking, Payment, Trip, Wallet...)
├── worker/                       # Chứa Dockerfile multi-stage build cho BullMQ Worker
├── load-test.js                  # Script kiểm thử tải (k6)
├── app.ts                        # Cấu hình Express App
├── server.ts                     # Khởi tạo Express Server & Graceful Shutdown
└── vercel.json                   # Cấu hình Deploy Vercel & Daemons
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
FRONTEND_URL=FRONTEND_URL="https://ticket-lekhai.vercel.app"
NODE_ENV="production"

# JWT (Tối thiểu 32 ký tự)
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
RESEND_FROM_EMAIL="NexusTicket <no-reply@yourdomain.com>"
fromEmail="NexusTicket <no-reply@yourdomain.com>"

# WebAuthn / Passkeys
WEBAUTHN_RP_ID="localhost"
WEBAUTHN_ORIGIN="http://localhost:5173"

# PayOS Payment Gateway
PAYOS_CLIENT_ID="YOUR_CLIENT_ID"
PAYOS_API_KEY="YOUR_API_KEY"
PAYOS_CHECKSUM_KEY="YOUR_CHECKSUM_KEY"

# Bảo mật mở rộng (HMAC, Cron & Mã hóa AES-256-GCM 64 ký tự Hex)
CRON_SECRET="YOUR_CRON_SECRET"
AUDIT_SECRET_KEY="YOUR_AUDIT_SECRET_HMAC_KEY"
ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

# Cấu hình tài khoản thật cho E2E Test (Playwright)
USER_TEST="abcd@gmail.com"
PASS_USER_TEST="abcd123@@"
```

---

## 🚀 7. Hướng Dẫn Cài Đặt & Chạy

### 7.1. Chạy Local (Backend & Frontend)

**Backend:**

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

_(Lưu ý: Sử dụng `npx prisma migrate deploy` thay vì `db push` để khởi tạo đầy đủ Partial Unique Index chống trùng ghế và Materialized View `revenue_stats`)._

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

### 7.2. Triển khai Mail Worker (Vercel Daemons + Docker)

Do Vercel Serverless không chạy được Background Process liên tục, hệ thống sử dụng **Vercel Daemons** để chạy BullMQ Worker thông qua Docker (`worker/Dockerfile`). File `Dockerfile` đã được tối ưu đa tầng (multi-stage build) để tránh lỗi Prisma Generate và giảm dung lượng Image.

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

## 🛡️ 8. Quy Trình Pre-flight (Đảm bảo Deploy 100% Thành Công)

Trước khi `git push` để deploy, bạn **BẮT BUỘC** phải thực hiện checklist sau để tránh lỗi build:

### Bước 1: Chạy kiểm tra tự động (Local Check)

Chạy lệnh sau ở Terminal:

```bash
npm run check-local
```

_(Script này sẽ tự động: Generate Prisma -> Check lỗi TypeScript Backend (đã bỏ qua thư mục frontend) -> Chạy toàn bộ Test -> Build thử Frontend. Nếu Terminal báo xanh hết, code của bạn 100% không bị lỗi build)._

### Bước 2: Kiểm tra file cấu hình (Manual Check)

- **`vercel.json`:** Đảm bảo cú pháp JSON hợp lệ. Đường dẫn `destination` trỏ đúng file Serverless (`/api/index.ts`).
- **`.env.example` và Vercel Dashboard:** Kiểm tra xem có thêm biến môi trường mới nào không (đặc biệt là `AUDIT_SECRET_KEY`, `CRON_SECRET`, `GEMINI_API_KEY`, `ENCRYPTION_KEY`).

### Bước 3: Quy trình Nâng cấp Database (Không Downtime)

Nếu có sửa file `schema.prisma` và tạo migration mới:

1. Lên web Admin, bấm **Bật Bảo Trì Khẩn Cấp**.
2. Push code lên Vercel.
3. Chờ Vercel build xong (Ready).
4. Ở máy local, chạy `npx prisma migrate deploy` để cập nhật Database Production.
5. Lên web Admin, bấm **Tắt Bảo Trì**.

---

## 💡 9. Ghi Chú & Lưu Ý

- **Thanh toán thật:** Hệ thống đang chạy PayOS ở môi trường Production. Mọi giao dịch đều trừ tiền thật.
- **Passkeys trên Vercel:** Đảm bảo biến môi trường `WEBAUTHN_RP_ID` và `WEBAUTHN_ORIGIN` được cấu hình chính xác với domain thực tế.
- **Trình duyệt hỗ trợ Passkeys:** Trên iOS, khuyên dùng Safari hoặc Brave để tránh lỗi API WebAuthn của Chrome.
- **Không hỗ trợ trả sau:** Hệ thống đã loại bỏ hoàn toàn tính năng "Đặt vé trả sau" (`LATER`) để chống chiếm ghế ảo. Bắt buộc thanh toán 100% qua Ví (`WALLET`).
- **Định hướng mở rộng (Logistics & Cargo):** Module mã hóa AES-256-GCM được thiết kế theo hướng "Extensibility by Default" (mở rộng mà không làm gián đoạn hệ thống). Các trường PII (như số điện thoại liên hệ nhận hàng/giao hàng) khi được kích hoạt ở các pha nâng cấp tiếp theo sẽ tự động được mã hóa ở tầng ứng dụng trước khi ghi xuống cơ sở dữ liệu.

---

_Cập nhật lần cuối: 11/11/2026_  
_Tác giả: Lê Hoàng Khải_  
_Repository: [https://github.com/lekhai123/Ticket](https://github.com/lekhai123/Ticket)_
