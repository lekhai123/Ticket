import { Queue, Worker, Job } from "bullmq";
import Redis from "ioredis";
import { sendOtpEmail } from "../config/resend";
import dotenv from "dotenv";
dotenv.config();

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error("[CONFIG ERROR] Thiếu REDIS_URL cho BullMQ!");
}

// Cấu hình Redis riêng cho BullMQ (tách biệt với Redis Cache)
const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // Yêu cầu bắt buộc của BullMQ
  enableReadyCheck: false,
  tls: redisUrl.startsWith("rediss://")
    ? { rejectUnauthorized: false }
    : undefined,
});

redisConnection.on("error", (err) => {
  console.error("[QUEUE REDIS ERROR]", err.message);
});

export interface MailJobData {
  email: string;
  code: string;
  type: "REGISTER" | "FORGOT_PASSWORD";
}

// 1. Khởi tạo Queue
export const mailQueue = new Queue<MailJobData>("mail-queue", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    removeOnFail: 100,
  },
});

// Biến lưu trữ Worker để tránh khởi tạo lại nhiều lần khi hot-reload
let mailWorker: Worker<MailJobData>;

// Kiểm tra môi trường để tránh tạo nhiều kết nối khi dev
if (!(global as any).mailWorker) {
  mailWorker = new Worker<MailJobData>(
    "mail-queue",
    async (job: Job<MailJobData>) => {
      const { email, code, type } = job.data;
      console.log(
        `[QUEUE WORKER] Đang xử lý gửi mail OTP: ${email} (Job: ${job.id})`,
      );

      const result = await sendOtpEmail(email, code, type);

      if (result?.error) {
        throw new Error(`Resend Error: ${result.error.message}`);
      }
      return result;
    },
    {
      connection: redisConnection,
      limiter: { max: 10, duration: 1000 }, // Tối đa 10 mail/giây
      concurrency: 5, // Xử lý song song 5 jobs
    },
  );

  // Gán vào global để tái sử dụng khi hot-reload
  (global as any).mailWorker = mailWorker;

  mailWorker.on("completed", (job) => {
    console.log(`[QUEUE SUCCESS] Đã gửi mail xong Job: ${job.id}`);
  });

  mailWorker.on("failed", (job, err) => {
    console.error(
      `[QUEUE FAILED] Job ${job?.id} thất bại. Lỗi: ${err.message}`,
    );
  });

  mailWorker.on("error", (err) => {
    console.error("[QUEUE WORKER ERROR] Lỗi Worker:", err.message);
  });
} else {
  mailWorker = (global as any).mailWorker;
}

export { mailWorker };
