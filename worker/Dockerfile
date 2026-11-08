FROM node:20-alpine
WORKDIR /app

# Copy package.json và cài dependencies
COPY package*.json ./
RUN npm ci

# Copy toàn bộ source code (nhờ .dockerignore đã chặn frontend)
COPY . .

# Chạy lệnh build (script "build" ta vừa thêm ở Bước 1)
RUN npm run build

# Chạy worker từ file đã build trong thư mục dist-api
CMD ["node", "dist-api/queues/mailQueue.ts"]