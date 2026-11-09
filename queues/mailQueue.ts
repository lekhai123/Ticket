import { Queue } from "bullmq";
import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

// Đảm bảo URL bắt đầu bằng rediss:// nếu dùng Upstash
const isTls = redisUrl.startsWith("rediss://");

const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // Bắt buộc cho BullMQ
  enableReadyCheck: false, // Quan trọng với Upstash
  keepAlive: 10000, // Giữ kết nối sống qua proxy
  tls: isTls ? { rejectUnauthorized: false } : undefined, // Hỗ trợ TLS
});

export interface MailJobData {
  email: string;
  code: string;
  type: "REGISTER" | "FORGOT_PASSWORD";
}

export const mailQueue = new Queue<MailJobData>("mail-queue", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    removeOnFail: 100,
  },
});
