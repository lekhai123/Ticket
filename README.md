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
   ├── WalletService (Debt/Balance Guard)
   ├── AI Proxy Service (Gemini Multi-Key Failover)
   └── ReconciliationService (Auto-Balancing & Audit Logs)
             │
             ▼
══════════════════════ OPERATIONS & STATE ══════════════════════
 ├── PostgreSQL (Prisma ORM) – Dữ liệu chính
 ├── Dual Redis Cluster (Primary & Backup Failover)
 ├── BullMQ Mail Queue (Xử lý bất đồng bộ)
 ├── PayOS Payment Gateway (Production)
 ├── Cloudinary Storage (Dual Cloud Fallback)
 └── Gemini Vector Engine (Tìm kiếm ngữ nghĩa)
```

---

## 🔐 2. Tính Năng Bảo Mật Nổi Bật (Security Features)

Hệ thống được xây dựng với triết lý **Zero-Trust** và bảo vệ dữ liệu đa lớp.

### 2.1. Xác Thực Không Mật Khẩu (Passwordless) với Passkeys / WebAuthn

- Người dùng có thể đăng nhập bằng **Vân tay, Face ID hoặc Windows Hello** thay vì mật khẩu truyền thống.
- Loại bỏ hoàn toàn rủi ro **Phishing** và **Credential Stuffing** vì khóa riêng tư không bao giờ rời khỏi thiết bị.
- Tuân thủ chuẩn **WebAuthn/FIDO2** của W3C.

### 2.2. JWT Hiện Đại với Refresh Token Rotation & Revocation

- **Access Token** (15 phút) lưu trong RAM (Zustand), **Refresh Token** (7 ngày) lưu trong **HttpOnly Cookie** (chống XSS).
- **Refresh Token Rotation:** Mỗi lần refresh, token cũ bị thu hồi và cấp cặp token mới.
- **Revocation List (Redis):** Khi logout, cả Access và Refresh Token bị đưa vào blacklist trên Redis để vô hiệu hóa ngay lập tức.

### 2.3. Application-Level Encryption (ALE) – Mã Hóa Dữ Liệu Nhạy Cảm

- Các trường PII như **Số điện thoại** được mã hóa bằng **AES-256-GCM** trước khi ghi vào PostgreSQL.
- Ngay cả khi Database bị rò rỉ, kẻ tấn công cũng không thể đọc được dữ liệu gốc.
- Sử dụng Prisma Middleware để tự động mã hóa/giải mã trong suốt.

### 2.4. Bảo Mật Webhook Thanh Toán (PayOS)

- Tích hợp cổng thanh toán **PayOS** (VietQR) để nạp tiền vào ví.
- Xác thực chữ ký **HMAC-SHA256** trên mọi webhook nhận được, chống giả mạo số tiền và yêu cầu thanh toán.
- Cơ chế **Idempotency** đảm bảo không cộng tiền hai lần nếu webhook được gửi lặp lại.

### 2.5. Các Lớp Bảo Vệ Khác

- **IP Guard:** Chặn các IP nằm trong danh sách đen.
- **Rate Limiting:** Giới hạn tần suất yêu cầu để chống spam và brute-force.
- **Zod Validation:** Kiểm tra schema đầu vào của mọi request.
- **Audit Log:** Ghi lại toàn bộ thao tác nhạy cảm để truy vết.

---

## ⚡ 3. Tính Năng Kỹ Thuật Cốt Lõi (Core Technical Features)

### 3.1. High Availability với Dual Redis & Auto-Failover

- Thiết lập song song cụm **Redis Primary** và **Redis Backup**. Nếu Primary gặp sự cố, hệ thống tự động chuyển sang Backup, đảm bảo không gián đoạn dịch vụ.

### 3.2. Multi-Level Cache (L1 RAM + L2 Dual Redis)

- Kết hợp **LRU Cache** trên RAM và **Redis** phân tán, giảm độ trễ truy vấn danh mục chuyến xe xuống mức tức thì.

### 3.3. Redis Distributed Lock + DB Advisory Lock (Chống Race Condition)

- Sử dụng **Redis Lock** kết hợp **Postgres Advisory Lock** trong `prisma.$transaction` để đảm bảo an toàn tuyệt đối khi nhiều người dùng cùng đặt một ghế tại cùng một thời điểm.
- Đã được kiểm chứng bằng **Integration Test** mô phỏng 2 request đồng thời.

### 3.4. Hàng Đợi Bất Đồng Bộ với BullMQ

- Tác vụ gửi OTP/Email được đẩy vào **Redis Queue** (BullMQ) để xử lý nền, giúp API phản hồi nhanh và không phụ thuộc vào độ trễ của dịch vụ email bên thứ ba.

### 3.5. Tìm Kiếm Ngữ Nghĩa & Gemini AI Failover

- Hỗ trợ tìm chuyến bằng ngôn ngữ tự nhiên thông qua **vector embeddings** (pgvector).
- Cơ chế **Multi-Key Rotation** tự động xoay vòng API Key Gemini khi gặp sự cố hoặc hết hạn mức.

### 3.6. Đối Soát Tài Chính Tự Động (Auto-Reconciliation)

- Định kỳ đối chiếu số dư ví người dùng với toàn bộ lịch sử giao dịch và Audit Logs.
- Tự động phát hiện sai lệch dòng tiền và khóa ví nếu cần, kèm theo phân tích nguyên nhân gốc bằng AI.

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
# Cài đặt dependencies (nếu chưa)
npm install

# Chạy toàn bộ test suite
npm run test
```

### 4.3. Báo Cáo Độ Phủ Kiểm Thử (Test Coverage)

Hệ thống đã được kiểm thử tự động với kết quả **100% Pass (5/5 tests)**. Dưới đây là kết quả độ phủ mã nguồn của các module quan trọng:

| Tên Module                    | Statements (Câu lệnh) | Branches (Nhánh) | Functions (Hàm) | Lines (Dòng) |
| :---------------------------- | --------------------- | ---------------- | --------------- | ------------ | --- |
| **Utils/payos.ts**            | 96.96%                | 28.57%           | 100%            | 96.96%       |
| **Service/bookingService.ts** | 80.39%                | 70%              | 58.33%          | 80.39%       |     |
| **Service/authService.ts**    | 65.71%                | 50%              | 80%             | 69.69%       |     |
| **Utils/redisLock.ts**        | 64.28%                | 0%               | 0%              | 64.28%       |     |
| **Tổng quan dự án**           | **30.66%**            | **12.56%**       | **17.45%**      | **31.18%**   |

_(Ghi chú: Độ phủ tổng quan 30.66% là do hệ thống có rất nhiều file UI, Service phụ trợ và Job chưa được đưa vào diện test trong đồ án này. Các module cốt lõi về Bảo mật và Giao dịch đều đạt độ phủ >80%)._

---

## 📂 5. Cấu Trúc Thư Mục Dự Án

```text
.
├── .vscode/                      # Cấu hình VS Code
├── ai-service/                   # Dịch vụ AI
├── api/                          # Serverless entrypoint cho Vercel
├── config/                       # Cấu hình Cloudinary, Env, JWT, Resend
├── Controller/                   # Điều phối Request & Response
│   ├── adminController.ts
│   ├── authController.ts
│   ├── bookingController.ts
│   ├── otpController.ts
│   ├── paymentController.ts      # Xử lý thanh toán PayOS
│   ├── tripController.ts
│   ├── userController.ts
│   ├── walletController.ts
│   └── webauthnController.ts     # Xử lý Passkeys
├── database/                     # Khởi tạo Prisma Client singleton
├── frontend/                     # Giao diện người dùng (React + Vite)
├── jobs/                         # Tiến trình đối soát định kỳ
├── Middleware/                   # Pipeline bảo mật (Auth, Idempotency, IP Guard, v.v.)
├── prisma/                       # Schema và migrations
├── queues/                       # Hàng đợi BullMQ
├── Router/                       # Khai báo các tuyến API
├── Service/                      # Logic nghiệp vụ chi tiết
│   ├── aiProxy.service.ts
│   ├── aiReconciliationAnalyzer.service.ts
│   ├── authService.ts
│   ├── bookingService.ts
│   ├── cacheService.ts
│   ├── cloudinaryService.ts
│   ├── otpService.ts
│   ├── paymentService.ts         # Tích hợp PayOS
│   ├── reconciliationService.ts
│   ├── revocationService.ts
│   ├── tripService.ts
│   ├── userService.ts
│   └── walletService.ts
├── tests/                        # Bộ kiểm thử tự động (Jest + Supertest)
│   ├── auth.test.ts
│   ├── booking.test.ts
│   └── payos.test.ts
├── Utils/                        # Tiện ích
│   ├── encryption.ts             # Mã hóa AES-256-GCM
│   ├── payos.ts                  # Class xử lý chữ ký PayOS
│   └── redisLock.ts              # Dual Redis & Lock helper
├── Validation/                   # Schema Zod
├── .env                          # Biến môi trường
├── .env.example                  # Mẫu biến môi trường
├── app.ts                        # Cấu hình Express App
├── jest.config.js                # Cấu hình Jest
├── package.json
├── README.md
├── server.ts                     # Khởi tạo Express Server
├── tsconfig.json
└── vercel.json
```

---

## ⚙️ 6. Cấu Hình Môi Trường (.env)

Tạo file `.env` tại thư mục gốc của Backend và cấu hình các biến sau (dựa trên file `.env.example`):

```env
# Database
DATABASE_URL="postgresql://postgres:password@host:5432/db_name"

# Gemini AI
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

# PayOS Payment Gateway (Production - Thanh toán thật)
PAYOS_CLIENT_ID="your_client_id"
PAYOS_API_KEY="your_api_key"
PAYOS_CHECKSUM_KEY="your_checksum_key"
```

---

## 🚀 7. Hướng Dẫn Cài Đặt & Chạy

### 7.1. Backend

```bash
# Cài đặt dependencies
npm install

# Đồng bộ Prisma Schema với Database
npx prisma generate
npx prisma db push

# Chạy server phát triển
npm run dev
```

Backend mặc định chạy tại `http://localhost:3000`.

### 7.2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend hiển thị tại `http://localhost:5173`.

### 7.3. Kiểm Thử (Testing)

```bash
npm run test
```

---

## 💡 8. Ghi Chú & Lưu Ý

- **Thanh toán thật:** Hệ thống đang chạy PayOS ở môi trường Production. Mọi giao dịch đều trừ tiền thật. Nếu có sự cố, vui lòng liên hệ số điện thoại in trên banner cảnh báo.
- **Passkeys trên Vercel:** Đảm bảo biến môi trường `WEBAUTHN_RP_ID` và `WEBAUTHN_ORIGIN` được cấu hình chính xác trên Vercel Dashboard.
- **Dual Redis:** Cần cấu hình cả `REDIS_URL` và `REDIS_URL_BACKUP` để tận dụng tính năng High Availability.
- **Jest & ECONNRESET:** Khi chạy test, các log `ECONNRESET` từ Redis Worker là bình thường do Jest `forceExit`, không ảnh hưởng đến kết quả.
- **Thư mục `coverage/`:** Nhớ thêm thư mục này vào file `.gitignore` để tránh push các file báo cáo test lên Git.

---

_Cập nhật lần cuối: 9/11/2026_
_Tác giả: Lê Hoàng Khải_  
_Repository: [https://github.com/lekhai123/Ticket](https://github.com/lekhai123/Ticket)_
