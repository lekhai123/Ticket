import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import { sendOtpEmail } from "../config/resend";
import { MailJobData, NotificationJobData, AllJobData } from "./mailQueue";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const isTls = redisUrl.startsWith("rediss://");

const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  keepAlive: 10000,
  tls: isTls ? { rejectUnauthorized: false } : undefined,
});

export const mailWorker = new Worker<AllJobData>(
  "mail-queue",
  async (job: Job<AllJobData>) => {
    // LOGIC 1: GỬI OTP
    if (job.name === "send-otp-job") {
      const { email, code, type } = job.data as MailJobData;
      console.log(`[QUEUE WORKER] Đang xử lý gửi mail OTP: ${email}`);

      const result = await sendOtpEmail(email, code, type);
      if (result?.error)
        throw new Error(`Resend Error: ${result.error.message}`);
      return result;
    }

    // LOGIC 2: GỬI THÔNG BÁO (Đã đặt đúng vào bên trong Worker)
    if (job.name === "send-notification-job") {
      const { email, type, data } = job.data as NotificationJobData;
      console.log(
        `[QUEUE WORKER] Đang xử lý gửi thông báo: ${type} cho ${email}`,
      );

      let subject = "";
      let html = "";

      if (type === "BOOKING_SUCCESS") {
        subject = `[NexusTicket] Đặt vé thành công - Chuyến ${data.route}`;
        html = `<p>Bạn đã thanh toán thành công vé ghế A${data.seat}.</p>`;
      } else if (type === "BOOKING_CANCEL") {
        subject = `[NexusTicket] Hủy vé thành công`;
        html = `<p>Bạn đã hủy vé chuyến ${data.route}. Tiền đã được hoàn vào ví.</p>`;
      } else if (type === "ADMIN_REVOKE") {
        subject = `[NexusTicket] Vé của bạn đã bị thu hồi`;
        html = `<p>Vé chuyến ${data.route} đã bị Admin thu hồi. Lý do: ${data.reason}</p>`;
      } else if (type === "ADMIN_GIFT") {
        subject = `[NexusTicket] Bạn nhận được quà tặng!`;
        html = `<p>Bạn vừa được Admin tặng ${data.amount} VNĐ. Lý do: ${data.reason}</p>`;
      }

      await resend.emails.send({
        from: "NexusTicket <security@binstudio.id.vn>",
        to: email,
        subject,
        html,
      });
      return { success: true };
    }
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
