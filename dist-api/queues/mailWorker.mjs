// queues/mailWorker.ts
import { Worker } from "bullmq";
import Redis from "ioredis";

// config/resend.ts
import { Resend } from "resend";
import dotenv from "dotenv";
dotenv.config();
function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[CONFIG ERROR] Thi\u1EBFu bi\u1EBFn m\xF4i tr\u01B0\u1EDDng "${name}" cho Resend!`
    );
  }
  return value;
}
var resendApiKey = requiredEnv("RESEND_API_KEY");
var resend = new Resend(resendApiKey);
var fromEmail = process.env.RESEND_FROM_EMAIL || "BinStudio <security@binstudio.id.vn>";
var sendOtpEmail = async (toEmail, code, type) => {
  const subject = type === "REGISTER" ? "[NexusTicket] M\xE3 x\xE1c th\u1EF1c \u0111\u0103ng k\xFD t\xE0i kho\u1EA3n" : "[NexusTicket] M\xE3 x\xE1c th\u1EF1c kh\xF4i ph\u1EE5c m\u1EADt kh\u1EA9u";
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f5;">
      <div style="max-width: 500px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 16px;">
        <h2 style="color: #18181b; margin-bottom: 8px;">X\xE1c th\u1EF1c t\xE0i kho\u1EA3n</h2>
        <p style="color: #71717a; font-size: 14px;">M\xE3 OTP c\u1EE7a b\u1EA1n c\xF3 hi\u1EC7u l\u1EF1c trong <b>5 ph\xFAt</b>. Vui l\xF2ng kh\xF4ng chia s\u1EBB m\xE3 n\xE0y v\u1EDBi b\u1EA5t k\u1EF3 ai.</p>
        <div style="background: #f4f4f5; padding: 16px; text-align: center; border-radius: 12px; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #4f46e5;">${code}</span>
        </div>
        <p style="color: #a1a1aa; font-size: 12px; text-align: center;">N\u1EBFu b\u1EA1n kh\xF4ng y\xEAu c\u1EA7u m\xE3 n\xE0y, vui l\xF2ng b\u1ECF qua email.</p>
      </div>
    </div>
  `;
  return await resend.emails.send({
    from: fromEmail,
    to: toEmail,
    subject,
    html
  });
};

// queues/mailWorker.ts
var redisConnection = new Redis(
  process.env.REDIS_URL || "redis://localhost:6379",
  {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  }
);
var mailWorker = new Worker(
  "mail-queue",
  async (job) => {
    const { email, code, type } = job.data;
    console.log(`[QUEUE WORKER] \u0110ang x\u1EED l\xFD g\u1EEDi mail OTP: ${email}`);
    const result = await sendOtpEmail(email, code, type);
    if (result?.error) throw new Error(`Resend Error: ${result.error.message}`);
    return result;
  },
  {
    connection: redisConnection,
    limiter: { max: 10, duration: 1e3 },
    concurrency: 5
  }
);
mailWorker.on(
  "completed",
  (job) => console.log(`[QUEUE SUCCESS] Xong Job: ${job.id}`)
);
mailWorker.on(
  "failed",
  (job, err) => console.error(`[QUEUE FAILED] Job ${job?.id} l\u1ED7i: ${err.message}`)
);
mailWorker.on(
  "error",
  (err) => console.error("[QUEUE WORKER ERROR]:", err.message)
);
console.log("\u{1F680} Mail Worker \u0111\xE3 kh\u1EDFi \u0111\u1ED9ng v\xE0 \u0111ang ch\u1EDD Job...");
export {
  mailWorker
};
