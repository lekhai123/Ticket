import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY || "re_123456789");

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
    from: "BinStudio <security@binstudio.id.vn>",
    to: toEmail,
    subject: subject,
    html: html,
  });
};
