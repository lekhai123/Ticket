-- ============================================================
-- Migration: thêm paymentMethod + paidAmount vào Tickets,
-- thay unique constraint bằng partial unique index (chỉ trên vé còn hiệu lực)
-- ============================================================

-- 1. Thêm 2 cột mới
ALTER TABLE "Tickets"
  ADD COLUMN "paymentMethod" TEXT,
  ADD COLUMN "paidAmount" DECIMAL(12, 2);

-- 2. Đánh dấu dữ liệu cũ
-- Vé CONFIRMED cũ (trước migrate): coi như mua bằng ví với giá trip hiện tại
UPDATE "Tickets" t
SET "paymentMethod" = 'LEGACY',
    "paidAmount" = (
      SELECT price FROM "Trips" WHERE "Trips".id = t."tripId"
    )
WHERE t.status = 'CONFIRMED'
  AND t."paymentMethod" IS NULL;

-- Vé PENDING cũ: thanh toán sau, chưa trả tiền
UPDATE "Tickets"
SET "paymentMethod" = 'LATER',
    "paidAmount" = 0
WHERE status = 'PENDING'
  AND "paymentMethod" IS NULL;

-- Vé HELD cũ: chưa thanh toán
UPDATE "Tickets"
SET "paymentMethod" = 'LATER',
    "paidAmount" = 0
WHERE status = 'HELD'
  AND "paymentMethod" IS NULL;

-- 3. Xóa unique constraint cũ (tên do Prisma đặt)
ALTER TABLE "Tickets"
  DROP CONSTRAINT IF EXISTS "Tickets_tripId_seatNumber_key";

-- 4. Tạo partial unique index — CHỈ trên vé còn hiệu lực
-- Vé CANCELED/USED/REVOKED/EXPIRED không còn chiếm slot ghế
DROP INDEX IF EXISTS "tickets_active_seat_unique";
CREATE UNIQUE INDEX "tickets_active_seat_unique"
ON "Tickets" ("tripId", "seatNumber")
WHERE status IN ('HELD', 'PENDING', 'CONFIRMED');

-- 5. Index thường cho query (không có UNIQUE)
CREATE INDEX IF NOT EXISTS "Tickets_tripId_seatNumber_idx"
ON "Tickets" ("tripId", "seatNumber");

CREATE INDEX IF NOT EXISTS "Tickets_userId_status_idx"
ON "Tickets" ("userId", "status");