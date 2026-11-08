FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
# trỏ đến file mailWorker.js mới
CMD ["node", "dist-api/mailWorker.js"]