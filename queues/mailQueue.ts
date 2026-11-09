import { Queue } from "bullmq";
import Redis from "ioredis";

export interface MailJobData {
  email: string;
  code: string;
  type: "REGISTER" | "FORGOT_PASSWORD";
}

export interface NotificationJobData {
  email: string;
  type:
    | "BOOKING_SUCCESS"
    | "BOOKING_SUCCESS_BATCH"
    | "BOOKING_CANCEL"
    | "ADMIN_REVOKE"
    | "ADMIN_REVOKE_BATCH"
    | "ADMIN_GIFT";
  data: Record<string, any>;
}

export type AllJobData = MailJobData | NotificationJobData;

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const isTls = redisUrl.startsWith("rediss://");

const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  keepAlive: 10000,
  tls: isTls ? { rejectUnauthorized: false } : undefined,
});

export const mailQueue = new Queue<AllJobData>("mail-queue", { connection });

export async function sendNotificationEmail(payload: {
  email: string;
  type: NotificationJobData["type"];
  data: Record<string, any>;
}) {
  await mailQueue.add("send-notification-job", payload, {
    attempts: 3,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: 200,
    removeOnFail: 500,
  });
}

export async function scheduleNotificationWithReset(
  payload: {
    email: string;
    type: NotificationJobData["type"];
    data: Record<string, any>;
  },
  opts: { delayMs: number; jobId: string },
) {
  // SỬA LỖI TẠI ĐÂY: BullMQ không cho phép dấu ":" trong jobId
  // Thay thế tất cả dấu ":" bằng "-"
  const safeJobId = opts.jobId.replace(/:/g, "-");

  try {
    const existing = await mailQueue.getJob(safeJobId);
    if (existing) {
      await existing.remove();
    }
  } catch (err: any) {
    console.warn(`[MAIL] Không thể xóa job cũ ${safeJobId}:`, err?.message);
  }

  try {
    await mailQueue.add("send-notification-job", payload, {
      delay: opts.delayMs,
      jobId: safeJobId,
      attempts: 3,
      backoff: { type: "exponential", delay: 3000 },
      removeOnComplete: 200,
      removeOnFail: 500,
    });
    console.log(`[MAIL] Đã xếp lịch job thành công: ${safeJobId}`);
  } catch (err: any) {
    console.error(`[MAIL] Lỗi khi xếp lịch job ${safeJobId}:`, err);
  }
}
