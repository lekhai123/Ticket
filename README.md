
```text
Hệ Thống Đặt Vé Phân Tán (High Availability, Dual Redis & AI Semantic Search)

Hệ thống đặt vé xe trực tuyến toàn diện theo mô hình kiến trúc Modular Monolith kết hợp giao diện Web App. Backend vận hành trên nền tảng Node.js, Express, TypeScript và PostgreSQL (Prisma ORM), tích hợp cơ chế Dual Redis Cluster, Multi-Level Cache, Redis Distributed Lock, BullMQ Queue, Gemini AI Multi-Key Failover và Đối soát tài chính tự động (Financial Reconciliation).  

1. Kiến Trúc & Sơ Đồ Luồng Dữ Liệu (System Architecture)
```text


[ Khách hàng / Quản trị viên ]
             │
             ▼
[ Frontend App (React / Vite / TSX) ] ──► [ Auth Hook / Client Service ]
             │
             ▼ (Cổng 5173 gọi REST API 3000)
═════════════════════════ API BOUNDARY ═════════════════════════
      [ Express API Gateway / Router ] (server.ts)
             │
   ┌─────────┼──────────┬──────────┬──────────┬─────────┐
   ▼         ▼          ▼          ▼          ▼         ▼
[Auth]    [Trips]   [Booking]   [Tickets]  [Wallets]  [Admin]
(Pipeline Middleware: Auth JWT, Idempotency, IP Guard, Tracing, Zod Validator)
             │
             ▼
════════════════════════ DOMAIN SERVICES ═══════════════════════
   ├── AuthService & OtpService (BullMQ / Resend Worker)
   ├── TripService & Multi-Level Cache (L1 Memory + L2 Redis)
   ├── BookingService & Redis Distributed Lock
   ├── WalletService & Debt/Balance Guard
   ├── AI Proxy Service (Gemini Multi-Key Rotation)
   └── ReconciliationService (Auto-Balancing & Audit Logs)
             │
             ▼
══════════════════════ OPERATIONS & STATE ══════════════════════
 ├── PostgreSQL (Prisma ORM) - Cơ sở dữ liệu chính
 ├── Dual Redis Cluster (Primary & Backup Failover)
 ├── BullMQ Mail Queue (Xử lý hàng đợi bất đồng bộ)
 ├── Cloudinary Storage (Dual Cloud Fallback)
 └── Gemini Vector Engine (Tìm kiếm ngữ nghĩa theo embedding)

 ```

2. Tính Năng Kỹ Thuật Trọng TâmDual Redis & Auto-Failover (High Availability):
```text 
Thiết lập song song cụm Redis chính và dự phòng. Khi node Primary gặp sự cố, hệ thống tự động failover sang node Backup giúp ứng dụng không bao giờ gián đoạn dịch vụ.  

Multi-Level Cache (L1 RAM + L2 Dual Redis): Kết hợp bộ nhớ RAM cục bộ và Redis phân tán, hạ độ trễ truy vấn các danh mục chuyến xe từ mức hàng nghìn mili-giây xuống ngưỡng tức thì.

Redis Distributed Lock (Chống Race Condition): Sử dụng khóa phân tán kết hợp Transaction nguyên tử (prisma.$transaction) đảm bảo an toàn tuyệt đối khi nhiều người cùng đặt chung một ghế tại cùng một thời điểm.

Tính Bất Biến Giao Dịch (Idempotency Guard): Bắt và ghi nhớ kết quả qua header x-idempotency-key, loại bỏ rủi ro trừ tiền ví hoặc tạo đơn trùng lặp.  

Hàng Đợi Gửi OTP BullMQ: Đẩy tác vụ gửi mã xác thực vào Redis Queue non-blocking giúp phản hồi nhanh chóng mà không bị phụ thuộc vào độ trễ của mạng gửi email bên thứ ba.   

Tìm Kiếm Ngữ Nghĩa & Gemini AI Failover: Hỗ trợ tìm chuyến bằng ngôn ngữ tự nhiên thông qua vector embeddings kết hợp cơ chế tự xoay vòng API Key dự phòng.

Đối Soát Tài Chính Tự Động (Auto-Reconciliation): Đối chiếu số dư ví người dùng với toàn bộ lịch sử giao dịch và Audit Logs, tự động phát hiện và cảnh báo sai lệch dòng tiền.
```

3. Cấu Trúc Thư Mục Dự Án
```text

├── api/
│   └── index.ts                 # Serverless entrypoint
├── config/
│   ├── cloudinary.ts            # Cấu hình lưu trữ ảnh Cloudinary
│   ├── jwt.ts                   # Cấu hình Secret & Token
│   └── resend.ts                # Cấu hình dịch vụ gửi mail Resend
├── Controller/                  # Điều phối Request & Response
│   ├── adminController.ts
│   ├── authController.ts
│   ├── bookingController.ts
│   ├── otpController.ts
│   ├── ticketController.ts
│   ├── tripController.ts
│   ├── userController.ts
│   └── walletController.ts
├── database/
│   └── prismaClient.ts          # Khởi tạo Prisma Client singleton
├── frontend/                    # Giao diện người dùng Web App (React / Vite)
├── jobs/
│   └── reconciliationJob.ts     # Tiến trình đối soát chạy định kỳ
├── Middleware/                  # Pipeline xử lý bảo mật
│   ├── authMiddleware.ts        # Kiểm tra Bearer Token JWT
│   ├── errorMiddleware.ts       # Bắt lỗi tập trung
│   ├── idempotencyMiddleware.ts # Chống trùng lặp Request
│   ├── ipGuard.ts               # Bảo vệ IP & Rate limit
│   ├── tracingMiddleware.ts     # Gắn ID truy vết vết lỗi
│   ├── upload.ts                # Middleware tải file
│   ├── validateMiddleware.ts    # Kiểm tra schema dữ liệu
│   └── walletGuard.ts           # Chặn giao dịch ví âm tiền
├── prisma/
│   └── schema.prisma            # Schema định nghĩa bảng cơ sở dữ liệu
├── queues/
│   └── mailQueue.ts             # Hàng đợi tác vụ BullMQ
├── Router/                      # Khai báo các đường dẫn API
│   ├── adminRoutes.ts
│   ├── authRoutes.ts
│   ├── bookingRoutes.ts
│   ├── otpRoutes.ts
│   ├── ticketRoutes.ts
│   ├── tripRoute.ts
│   ├── userRoutes.ts
│   └── walletRoutes.ts
├── Service/                     # Logic nghiệp vụ xử lý chi tiết
│   ├── adminService.ts
│   ├── aiProxy.service.ts       # Xoay vòng Gemini Key
│   ├── aiReconciliationAnalyzer.service.ts
│   ├── authService.ts
│   ├── bookingService.ts        # Giữ ghế, trừ tiền và tạo vé
│   ├── cacheService.ts          # Đọc/ghi bộ nhớ đệm đa tầng
│   ├── cloudinaryService.ts     # Upload ảnh & fallback bucket
│   ├── otpService.ts
│   ├── reconciliationService.ts # Đối soát số dư
│   ├── revocationService.ts
│   ├── ticketService.ts
│   ├── tripService.ts
│   ├── userService.ts
│   └── walletService.ts
├── Utils/
│   └── redisLock.ts             # Khởi tạo kết nối Dual Redis & Lock helper
├── Validation/                  # Schema validate Zod đầu vào
├── .env                         # Tệp cấu hình biến môi trường
├── server.ts                    # Khởi tạo máy chủ Express
├── test-all.ts                  # Bộ kiểm thử tích hợp tự động
└── tsconfig.json                # Cấu hình TypeScript
```
4. Cấu Hình Môi Trường (.env)

Tạo file .env tại thư mục gốc của backend và điền các biến cấu hình:   
```text

DATABASE_URL="postgresql://postgres:your_password@your_host:5432/your_database"

GEMINI_API_KEY="AIzaSyYourPrimaryGeminiApiKey"
GEMINI_SECONDARY_KEY="AIzaSyYourBackupGeminiApiKey"

REDIS_URL="redis://default:your_primary_token@your_primary_redis_host:6379"
REDIS_URL_BACKUP="redis://default:your_backup_token@your_backup_redis_host:6379"

VITE_API_URL="http://localhost:3000/api"

JWT_SECRET="your_jwt_secret_key"
JWT_ACCESS_SECRET="your_access_secret_key"
JWT_REFRESH_SECRET="your_refresh_secret_key"

CLOUDINARY_CLOUD_NAME="your_cloudinary_cloud_name"
CLOUDINARY_API_KEY="your_cloudinary_api_key"
CLOUDINARY_API_SECRET="your_cloudinary_api_secret"

CLOUDINARY_CLOUD_NAME_BACKUP="your_backup_cloud_name"
CLOUDINARY_API_KEY_BACKUP="your_backup_api_key"
CLOUDINARY_API_SECRET_BACKUP="your_backup_api_secret"

RESEND_API_KEY="re_your_resend_api_key"
FRONTEND_URL="https://ticket-app-domain.com"
```

5. Hướng Dẫn Cài Đặt & Chạy Hệ Thống
```text
5.1. Khởi Chạy Backend
Cài đặt các gói thư viện:

        npm install

Đồng bộ Prisma Schema với Database:

        npx prisma generate
        npx prisma db push

Chạy Backend ở chế độ phát triển:

        npm run dev

Backend mặc định chạy tại địa chỉ: http://localhost:3000

5.2. Khởi Chạy Frontend

Di chuyển vào thư mục FE:

        cd frontend

Cài đặt các gói thư viện cho Frontend:

        npm install

Khởi động máy chủ giao diện:
     
        npm run dev

Ứng dụng Frontend hiển thị tại: http://localhost:5173
```

6. Kiểm Thử Tự Động (Integration Test Suite)
```text

Dự án có sẵn script test-all.ts để kiểm tra toàn bộ luồng vận hành từ đầu đến cuối một cách độc lập:

        npx ts-node test-all.ts

Các Hạng Mục Kiểm Thử Thực Tế:

HA Health Check: Kiểm tra sức khỏe toàn hệ thống và trạng thái kết nối cụm Dual Redis (Primary/Backup Failover).

Xác thực JWT: Kiểm thử đăng nhập người dùng và cấp phát Access Token.

Setup Ví & Topup: Kiểm tra nạp tiền tự động vào ví test.

Hiệu năng Multi-Level Cache: Đo đạc so sánh thời gian truy vấn giữa Database Miss và Cache Hit.

Redis Lock Chống Race Condition: Bắn đồng thời 5 request cùng tranh chấp 1 ghế để xác nhận chỉ 1 request thành công.

Async OTP Queue: Kiểm tra tiến trình đẩy email xác thực vào hàng đợi BullMQ.

Idempotency Guard: Kiểm tra tính nguyên vẹn dữ liệu khi gửi lặp lại cùng một Request Key.

Semantic Search & AI Failover: Thử nghiệm tìm kiếm bằng ngôn ngữ tự nhiên và cơ chế chuyển đổi Key AI.

Cloudinary Pipeline Fallback: Đánh giá độ an toàn luồng upload ảnh đại diện khi có sự cố.

Đối Soát Tài Chính Tự Động: Kích hoạt quét so khớp lịch sử giao dịch và cân đối ví.

Bảo Vệ Số Dư Ví: Xác nhận hệ thống chặn các giao dịch đặt vé vượt quá số dư khả dụng.

Teardown Dữ Liệu: Tự động hủy vé và đưa ghế test về lại trạng thái trống sau khi kiểm thử xong.
```
```