# Giai đoạn 1: Cài đặt dependencies
FROM node:20-alpine AS deps
WORKDIR /app
# Chỉ copy các file quản lý package
COPY package.json package-lock.json ./
# Thêm --ignore-scripts để bỏ qua postinstall (tránh lỗi prisma generate khi chưa có source)
RUN npm ci --ignore-scripts

# Giai đoạn 2: Build và Generate Prisma Client
FROM node:20-alpine AS builder
WORKDIR /app
# Copy node_modules từ giai đoạn deps
COPY --from=deps /app/node_modules ./node_modules
# Copy toàn bộ source code (bao gồm cả thư mục prisma/schema.prisma)
COPY . .
# Chạy generate Prisma Client ở đây (lúc này đã có đủ source)
RUN npx prisma generate
# Chạy build code (nếu worker của bạn cần build TypeScript)
RUN npm run build

# Giai đoạn 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Copy các artifact cần thiết từ builder
COPY --from=builder /app/node_modules ./node_modules

# Đổi /app/dist thành /app/dist-api
COPY --from=builder /app/dist-api ./dist-api
COPY --from=builder /app/prisma ./prisma

# ✅ SỬA Ở ĐÂY: Lệnh CMD cũng phải trỏ đúng vào dist-api
CMD ["node", "dist-api/queues/mailWorker.mjs"]