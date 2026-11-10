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
      const result = await sendOtpEmail(email, code, type);
      if (result?.error)
        throw new Error(`Resend Error: ${result.error.message}`);
      return result;
    }

    if (job.name === "send-notification-job") {
      const { email, type, data } = job.data as NotificationJobData;

      try {
        let subject = "";
        let html = "";

        if (
          type === "BOOKING_SUCCESS_BATCH" ||
          type === "ADMIN_REVOKE_BATCH" ||
          type === "ADMIN_REVOKE_MULTIPLE"
        ) {
          const { userId, batchId, reason, ticketIds } = data as {
            userId: number;
            batchId?: string | null;
            reason?: string;
            ticketIds?: number[];
          };
          const targetStatus =
            type === "BOOKING_SUCCESS_BATCH" ? "CONFIRMED" : "REVOKED_BY_ADMIN";
          const where: any = { userId, status: targetStatus };

          // Nếu có truyền mảng ticketIds (dùng cho thu hồi hàng loạt)
          if (ticketIds && ticketIds.length > 0) {
            where.id = { in: ticketIds };
          } else if (batchId && !batchId.startsWith("SINGLE_")) {
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

          if (tickets.length === 0) return { success: true, skipped: true };

          const user = tickets[0].user;
          const route = tickets[0].trip.route;
          const seats = tickets.map((t) => `A${t.seatNumber}`).join(", ");
          const totalAmount = tickets.reduce(
            (s, t) => s + Number(t.paidAmount || 0),
            0,
          );

          const rowsHtml = `
            <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;">Chuyến xe</td><td style="padding:8px 12px;border:1px solid #e5e7eb;">${route}</td></tr>
            <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;">Ghế (${tickets.length})</td><td style="padding:8px 12px;border:1px solid #e5e7eb;">${seats}</td></tr>
          `;

          if (type !== "BOOKING_SUCCESS_BATCH") {
            subject = `[NexusTicket] ${tickets.length} vé của bạn đã bị thu hồi`;
            html = `<div style="font-family:Arial,sans-serif;padding:24px;"><h2 style="color:#dc2626;">Thông báo thu hồi vé</h2><p>Xin chào <b>${user.fullName}</b>,</p><p>Các vé sau đây đã bị Admin thu hồi:</p><table style="border-collapse:collapse;width:100%;">${rowsHtml}<tr><td style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;">Lý do</td><td style="padding:8px 12px;border:1px solid #e5e7eb;color:#dc2626;"><b>${reason || "Admin thu hồi"}</b></td></tr><tr><td style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;">Hoàn tiền</td><td style="padding:8px 12px;border:1px solid #e5e7eb;color:#16a34a;"><b>${formatVND(totalAmount)}</b></td></tr></table><p>Tiền hoàn đã được cộng vào ví.</p></div>`;
          } else {
            subject = `[NexusTicket] Đặt vé thành công - Chuyến ${route}`;
            html = `<div style="font-family:Arial,sans-serif;padding:24px;"><h2 style="color:#16a34a;">Đặt vé thành công</h2><p>Xin chào <b>${user.fullName}</b>,</p><table style="border-collapse:collapse;width:100%;">${rowsHtml}<tr><td style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;">Tổng tiền</td><td style="padding:8px 12px;border:1px solid #e5e7eb;color:#16a34a;"><b>${formatVND(totalAmount)}</b></td></tr></table></div>`;
          }
        } else if (type === "WALLET_LOCKED_AI") {
          subject = `[NexusTicket] Cảnh báo: Ví của bạn đã bị tạm khóa`;
          html = `
            <div style="font-family:Arial,sans-serif;padding:24px;color:#111827;">
              <h2 style="color:#dc2626;">Cảnh báo bảo mật tài khoản</h2>
              <p>Xin chào <b>${data.userName}</b>,</p>
              <p>Hệ thống AI của chúng tôi vừa phát hiện sự bất thường về số dư trong ví điện tử của bạn.</p>
              <div style="background:#fef2f2;padding:16px;border-radius:8px;margin:16px 0;">
                <p style="margin:0;">Số dư thực tế: <b>${formatVND(data.actualBalance)}</b></p>
                <p style="margin:8px 0 0 0;">Số dư hệ thống ghi nhận: <b>${formatVND(data.calculatedBalance)}</b></p>
              </div>
              <p>Để bảo vệ tài sản, ví của bạn đã bị <b>tạm khóa</b>. Vui lòng liên hệ bộ phận CSKH (Hotline: 0363.489.863) để được xác minh và mở khóa.</p>
            </div>`;
        } else if (type === "BOOKING_CANCEL") {
          subject = `[NexusTicket] Hủy vé thành công`;
          html = `<p>Bạn đã hủy vé chuyến <b>${data.route}</b> (Ghế A${data.seat}). Tiền đã được hoàn vào ví.</p>`;
        } else if (type === "ADMIN_GIFT") {
          subject = `[NexusTicket] Bạn nhận được quà tặng!`;
          html = `<p>Bạn vừa được Admin tặng <b>${formatVND(Number(data.amount))}</b> vào ví.</p><p><b>Lý do:</b> ${data.reason || "Quà tặng từ hệ thống"}</p>`;
        } else if (type === "ADMIN_REVOKE_GIFT") {
          subject = `[NexusTicket] Thông báo thu hồi quà tặng`;
          html = `<p>Admin đã thu hồi <b>${formatVND(Number(data.amount))}</b> từ ví của bạn.</p><p><b>Lý do:</b> ${data.reason}</p>`;
        }

        if (!subject || !html) return { success: false, skipped: true };

        const mailRes = await resend.emails.send({
          from: fromEmail,
          to: email,
          subject,
          html,
        });

        if (mailRes.error) throw new Error(mailRes.error.message);
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
console.log("Mail Worker đã khởi động và chờ Job...");
