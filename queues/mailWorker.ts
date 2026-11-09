import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import { sendOtpEmail } from "../config/resend";
import { MailJobData } from "./mailQueue";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const isTls = redisUrl.startsWith("rediss://");

const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  keepAlive: 10000,
  tls: isTls ? { rejectUnauthorized: false } : undefined,
});

export const mailWorker = new Worker<MailJobData>(
  "mail-queue",
  async (job: Job<MailJobData>) => {
    const { email, code, type } = job.data;
    console.log(`[QUEUE WORKER] Đang xử lý gửi mail OTP: ${email}`);
    const result = await sendOtpEmail(email, code, type);
    if (result?.error) throw new Error(`Resend Error: ${result.error.message}`);
    return result;
  },
  {
    connection: redisConnection,
    limiter: { max: 10, duration: 1000 },
    concurrency: 5,
  },
);

mailWorker.on("completed", (job) =>
  console.log(`[QUEUE SUCCESS] Xong Job: ${job.id}`),
);
mailWorker.on("failed", (job, err) =>
  console.error(`[QUEUE FAILED] Job ${job?.id} lỗi: ${err.message}`),
);
mailWorker.on("error", (err) => {
  console.error("[QUEUE WORKER ERROR]:", err.message);
});

console.log("🚀 Mail Worker đã khởi động và đang chờ Job...");
