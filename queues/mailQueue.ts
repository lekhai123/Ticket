// FILE: queues/mailQueue.ts
import { Queue, Worker, Job } from "bullmq";
import Redis from "ioredis";
import { sendOtpEmail } from "../config/resend";

// Dùng chung Redis Connection từ Upstash hoặc Redis Local
const redisConnection = new Redis(
  process.env.REDIS_URL || "redis://localhost:6379",
  {
    maxRetriesPerRequest: null, // Yêu cầu bắt buộc của BullMQ
  },
);

export interface MailJobData {
  email: string;
  code: string;
  type: "REGISTER" | "FORGOT_PASSWORD";
}

// 🎯 1. Khởi tạo Queue gửi mail
export const mailQueue = new Queue<MailJobData>("mail-queue", {
  connection: redisConnection,
});

// 🎯 2. Khởi tạo Worker xử lý background
export const mailWorker = new Worker<MailJobData>(
  "mail-queue",
  async (job: Job<MailJobData>) => {
    const { email, code, type } = job.data;
    console.log(
      `🚀 [QUEUE WORKER] Đang xử lý gửi mail OTP cho: ${email} (Job ID: ${job.id})`,
    );

    // Gọi hàm gửi Resend đã viết sẵn
    const result = await sendOtpEmail(email, code, type);

    if (result?.error) {
      throw new Error(`Resend Error: ${result.error.message}`);
    }

    return result;
  },
  {
    connection: redisConnection,
    // 🛡️ CHỐNG RATE LIMIT RESEND: Giới hạn tối đa 10 mail / 1 giây
    limiter: {
      max: 10,
      duration: 1000,
    },
    concurrency: 5, // Xử lý song song 5 jobs cùng lúc
  },
);

// Event Listeners để logging cho đẹp
mailWorker.on("completed", (job) => {
  console.log(
    `✅ [QUEUE SUCCESS] Đã gửi mail thành công cho Job ID: ${job.id}`,
  );
});

mailWorker.on("failed", (job, err) => {
  console.error(
    `❌ [QUEUE FAILED] Job ID ${job?.id} thất bại. Lỗi: ${err.message}`,
  );
});
