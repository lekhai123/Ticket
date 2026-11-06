import { Resend } from "resend";
import dotenv from "dotenv";
dotenv.config();

// Hàm bắt buộc phải có biến môi trường
function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[CONFIG ERROR] Thiếu biến môi trường "${name}" cho Resend!`,
    );
  }
  return value;
}

// Bắt buộc phải có API Key
const resendApiKey = requiredEnv("RESEND_API_KEY");
export const resend = new Resend(resendApiKey);

// Cho phép tùy chỉnh email gửi đi qua .env, nếu không có dùng mặc định
const fromEmail =
  process.env.RESEND_FROM_EMAIL || "BinStudio <security@binstudio.id.vn>";

export const sendOtpEmail = async (
  toEmail: string,
  code: string,
  type: "REGISTER" | "FORGOT_PASSWORD",
) => {
  const subject =
    type === "REGISTER"
      ? "[NexusTicket] Mã xác thực đăng ký tài khoản"
      : "[NexusTicket] Mã xác thực khôi phục mật khẩu";

  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f5;">
      <div style="max-width: 500px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 16px;">
        <h2 style="color: #18181b; margin-bottom: 8px;">Xác thực tài khoản</h2>
        <p style="color: #71717a; font-size: 14px;">Mã OTP của bạn có hiệu lực trong <b>5 phút</b>. Vui lòng không chia sẻ mã này với bất kỳ ai.</p>
        <div style="background: #f4f4f5; padding: 16px; text-align: center; border-radius: 12px; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #4f46e5;">${code}</span>
        </div>
        <p style="color: #a1a1aa; font-size: 12px; text-align: center;">Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email.</p>
      </div>
    </div>
  `;

  return await resend.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: subject,
    html: html,
  });
};
