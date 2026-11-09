import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import { Resend } from "resend";
import { sendOtpEmail } from "../config/resend";
import prisma from "../database/prismaClient";
import { MailJobData, NotificationJobData, AllJobData } from "./mailQueue";

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.fromEmail;

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const isTls = redisUrl.startsWith("rediss://");

const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  keepAlive: 10000,
  tls: isTls ? { rejectUnauthorized: false } : undefined,
});

const formatVND = (n: number) =>
  new Intl.NumberFormat("vi-VN").format(n) + " VNĐ";

export const mailWorker = new Worker<AllJobData>(
  "mail-queue",
  async (job: Job<AllJobData>) => {
    if (job.name === "send-otp-job") {
      const { email, code, type } = job.data as MailJobData;
      console.log(`[QUEUE WORKER] OTP: ${email}`);
      const result = await sendOtpEmail(email, code, type);
      if (result?.error)
        throw new Error(`Resend Error: ${result.error.message}`);
      return result;
    }

    if (job.name === "send-notification-job") {
      const { email, type, data } = job.data as NotificationJobData;
      console.log(`[QUEUE WORKER] Notif ${type} -> ${email}`);

      try {
        let subject = "";
        let html = "";

        if (type === "BOOKING_SUCCESS_BATCH" || type === "ADMIN_REVOKE_BATCH") {
          const { userId, batchId, reason } = data as {
            userId: number;
            batchId: string | null;
            reason?: string;
          };
          const targetStatus =
            type === "ADMIN_REVOKE_BATCH" ? "REVOKED_BY_ADMIN" : "CONFIRMED";
          const where: any = { userId, status: targetStatus };

          if (batchId && !batchId.startsWith("SINGLE_")) {
            where.batchId = batchId;
          } else if (batchId?.startsWith("SINGLE_")) {
            const id = Number(batchId.replace("SINGLE_", ""));
            if (!isNaN(id)) where.id = id;
          } else {
            where.createdAt = { gte: new Date(Date.now() - 15000) };
          }

          const tickets = await prisma.tickets.findMany({
            where,
            include: { trip: true, user: true },
            orderBy: { seatNumber: "asc" },
          });

          if (tickets.length === 0) {
            console.log(`[QUEUE WORKER] ${type}: Không có vé nào -> skip`);
            return { success: true, skipped: true };
          }

          const user = tickets[0].user;
          const route = tickets[0].trip.route;
          const seats = tickets.map((t) => `A${t.seatNumber}`).join(", ");
          const totalAmount = tickets.reduce(
            (s, t) => s + Number(t.paidAmount || 0),
            0,
          );

          const rowsHtml = `
            <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;width:160px;">Email khách</td><td style="padding:8px 12px;border:1px solid #e5e7eb;">${user.email}</td></tr>
            <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;">Chuyến xe</td><td style="padding:8px 12px;border:1px solid #e5e7eb;">${route}</td></tr>
            <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;">Ghế (${tickets.length})</td><td style="padding:8px 12px;border:1px solid #e5e7eb;">${seats}</td></tr>
          `;

          if (type === "ADMIN_REVOKE_BATCH") {
            subject = `[NexusTicket] ${tickets.length} vé của bạn đã bị thu hồi`;
            html = `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111827;">
                <h2 style="color:#dc2626;margin:0 0 16px;">Thông báo thu hồi vé</h2>
                <p>Xin chào <b>${user.fullName}</b>,</p>
                <p>Các vé sau đây của bạn đã bị Admin thu hồi:</p>
                <table style="border-collapse:collapse;width:100%;margin:16px 0;">
                  ${rowsHtml}
                  <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;">Lý do</td><td style="padding:8px 12px;border:1px solid #e5e7eb;color:#dc2626;"><b>${reason || "Admin thu hồi"}</b></td></tr>
                  <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;">Hoàn tiền</td><td style="padding:8px 12px;border:1px solid #e5e7eb;color:#16a34a;"><b>${formatVND(totalAmount)}</b></td></tr>
                </table>
                <p>Tiền hoàn đã được cộng vào ví điện tử của bạn.</p>
              </div>`;
          } else {
            subject = `[NexusTicket] Đặt vé thành công - Chuyến ${route}`;
            html = `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111827;">
                <h2 style="color:#16a34a;margin:0 0 16px;">Đặt vé thành công</h2>
                <p>Xin chào <b>${user.fullName}</b>,</p>
                <p>Bạn đã đặt thành công <b>${tickets.length} vé</b>:</p>
                <table style="border-collapse:collapse;width:100%;margin:16px 0;">
                  ${rowsHtml}
                  <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;">Tổng tiền</td><td style="padding:8px 12px;border:1px solid #e5e7eb;color:#16a34a;"><b>${formatVND(totalAmount)}</b></td></tr>
                </table>
                <p>Chúc bạn có chuyến đi vui vẻ!</p>
              </div>`;
          }
        } else if (type === "BOOKING_SUCCESS") {
          subject = `[NexusTicket] Đặt vé thành công - Chuyến ${data.route}`;
          html = `<p>Bạn đã thanh toán thành công vé ghế A${data.seat}.</p>`;
        } else if (type === "BOOKING_CANCEL") {
          subject = `[NexusTicket] Hủy vé thành công`;
          html = `<p>Bạn đã hủy vé chuyến <b>${data.route}</b> (Ghế A${data.seat}). Tiền đã được hoàn vào ví.</p>`;
        } else if (type === "ADMIN_REVOKE") {
          subject = `[NexusTicket] Vé của bạn đã bị thu hồi`;
          html = `<p>Vé chuyến <b>${data.route}</b> (Ghế A${data.seat || "?"}) đã bị Admin thu hồi.</p><p><b>Lý do:</b> ${data.reason}</p>`;
        } else if (type === "ADMIN_GIFT") {
          subject = `[NexusTicket] Bạn nhận được quà tặng!`;
          html = `<p>Bạn vừa được Admin tặng <b>${formatVND(Number(data.amount))}</b> vào ví.</p><p><b>Lý do:</b> ${data.reason || "Quà tặng từ hệ thống"}</p>`;
        } else if (type === "ADMIN_REVOKE_GIFT") {
          subject = `[NexusTicket] Thông báo thu hồi quà tặng`;
          html = `<p>Admin đã thu hồi <b>${formatVND(Number(data.amount))}</b> từ ví của bạn.</p><p><b>Lý do:</b> ${data.reason}</p>`;
        }

        if (!subject || !html) {
          console.warn(`[QUEUE WORKER] Unknown type: ${type} -> skip`);
          return { success: false, skipped: true };
        }

        const mailRes = await resend.emails.send({
          from: fromEmail,
          to: email,
          subject,
          html,
        });

        if (mailRes.error) {
          console.error(`[QUEUE WORKER] Resend từ chối:`, mailRes.error);
          throw new Error(mailRes.error.message);
        }

        console.log(`[QUEUE WORKER] Gửi mail thành công tới ${email}`);
        return { success: true };
      } catch (error: any) {
        console.error(`[QUEUE WORKER] Lỗi xử lý thông báo ${type}:`, error);
        throw error;
      }
    }
  },
  {
    connection: redisConnection,
    limiter: { max: 10, duration: 1000 },
    concurrency: 5,
  },
);

mailWorker.on("completed", (job) =>
  console.log(`[QUEUE SUCCESS] Job ${job.id}`),
);
mailWorker.on("failed", (job, err) =>
  console.error(`[QUEUE FAILED] Job ${job?.id}: ${err.message}`),
);
mailWorker.on("error", (err) =>
  console.error("[QUEUE WORKER ERROR]:", err.message),
);

console.log("Mail Worker đã khởi động và đang chờ Job...");
