# Sử dụng image Node.js chính thức
FROM node:20-alpine

# Đặt thư mục làm việc
WORKDIR /app

# Copy package.json và cài đặt dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy toàn bộ source code
COPY . .

# Build code TypeScript (nếu cần)
RUN npm run build

# Lệnh để khởi chạy worker
CMD ["node", "dist/queues/mailQueue.ts"]