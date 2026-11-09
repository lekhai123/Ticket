import { Queue } from "bullmq";
import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  keepAlive: 10000,
  tls: redisUrl.startsWith("rediss://")
    ? { rejectUnauthorized: false }
    : undefined,
});

//Khai báo 2 interface riêng biệt
export interface MailJobData {
  email: string;
  code: string;
  type: "REGISTER" | "FORGOT_PASSWORD";
}

export interface NotificationJobData {
  email: string;
  type: "BOOKING_SUCCESS" | "BOOKING_CANCEL" | "ADMIN_REVOKE" | "ADMIN_GIFT";
  data?: any;
}

// Tạo Union Type để Queue chấp nhận cả 2 loại job
export type AllJobData = MailJobData | NotificationJobData;

export const mailQueue = new Queue<AllJobData>("mail-queue", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    removeOnFail: 100,
  },
});

// Hàm helper để đẩy Job thông báo vào Queue
export const sendNotificationEmail = async (payload: NotificationJobData) => {
  await mailQueue.add("send-notification-job", payload);
};
