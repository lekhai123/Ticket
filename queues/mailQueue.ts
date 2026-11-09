import { Queue } from "bullmq";
import Redis from "ioredis";

// ============================================================
// TYPES
// ============================================================
export interface MailJobData {
  email: string;
  code: string;
  type: string;
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

// ============================================================
// REDIS CONNECTION
// ============================================================
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const isTls = redisUrl.startsWith("rediss://");

const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  keepAlive: 10000,
  tls: isTls ? { rejectUnauthorized: false } : undefined,
});

export const mailQueue = new Queue<AllJobData>("mail-queue", { connection });

// ============================================================
// HELPERS
// ============================================================

/**
 * Đẩy job thường (dùng cho OTP, mail đơn lẻ).
 * Chỉ add vào queue → trả về gần như ngay (<50ms).
 */
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

/**
 * Schedule DELAYED + RESET nếu jobId đã tồn tại.
 * Mục đích: gom nhiều ticket cùng batch vào 1 mail duy nhất.
 *
 * Luồng:
 *  - revoke vé 1 → add job T+30s (jobId cố định)
 *  - revoke vé 2 cùng batch → REMOVE job cũ, ADD lại T+30s
 *  - revoke vé 3 cùng batch → REMOVE job cũ, ADD lại T+30s
 *  - ...admin dừng → sau 30s job chạy → worker query tất cả vé
 *    cùng batch → render 1 mail duy nhất.
 */
export async function scheduleNotificationWithReset(
  payload: {
    email: string;
    type: NotificationJobData["type"];
    data: Record<string, any>;
  },
  opts: { delayMs: number; jobId: string },
) {
  try {
    const existing = await mailQueue.getJob(opts.jobId);
    if (existing) {
      await existing.remove();
    }
    await mailQueue.add("send-notification-job", payload, {
      delay: opts.delayMs,
      jobId: opts.jobId,
      attempts: 3,
      backoff: { type: "exponential", delay: 3000 },
      removeOnComplete: 200,
      removeOnFail: 500,
    });
  } catch (err: any) {
    console.warn("[MAIL] scheduleNotificationWithReset lỗi:", err?.message);
  }
}
