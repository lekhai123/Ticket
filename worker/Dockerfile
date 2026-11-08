FROM node:20-alpine
WORKDIR /app

# Copy package.json và cài dependencies
COPY package*.json ./
RUN npm ci

# Copy toàn bộ source code
COPY . .

# Build code (phải chạy lệnh này để tạo ra thư mục dist-api)
RUN npm run build

# Sửa đường dẫn ở đây (thêm /queues/)
CMD ["node", "dist-api/queues/mailWorker.mjs"]