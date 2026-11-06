import prisma from "../database/prismaClient";
import { mailQueue } from "../queues/mailQueue";
import crypto from "crypto";

// Số lần nhập sai tối đa trước khi vô hiệu OTP
const MAX_ATTEMPTS = 5;

export class OtpService {
  /**
   * Tạo OTP, lưu DB, đẩy job gửi email vào BullMQ.
   * Cooldown 60s chống spam + xóa OTP cũ của cùng email/type.
   */
  static async createOTPLogic(
    email: string,
    type: "REGISTER" | "FORGOT_PASSWORD" = "REGISTER",
  ) {
    const cleanEmail = email.toLowerCase().trim();
    const now = new Date();

    // Chặn spam: không cho yêu cầu mã mới trong vòng 1 phút
    const oneMinuteAgo = new Date(now.getTime() - 1 * 60 * 1000);
    const standardSpamCheck = await prisma.oTP.findFirst({
      where: {
        email: cleanEmail,
        type: type as any,
        createAt: { gte: oneMinuteAgo },
      },
    });

    if (standardSpamCheck) {
      const error: any = new Error(
        "Vui lòng đợi 1 phút trước khi yêu cầu mã mới!",
      );
      error.statusCode = 429;
      throw error;
    }

    const otpCode = crypto.randomInt(100000, 999999).toString();
    const expiredAt = new Date(now.getTime() + 5 * 60 * 1000);

    // Xóa OTP cũ của email + type (chỉ giữ 1 mã hiệu lực)
    await prisma.oTP.deleteMany({
      where: { email: cleanEmail, type: type as any },
    });

    // ✅ attempts khởi tạo 0, tăng mỗi lần nhập sai
    const newOtp = await prisma.oTP.create({
      data: {
        email: cleanEmail,
        code: otpCode,
        type: type as any,
        expiredAt,
        attempts: 0,
      },
    });

    try {
      await mailQueue.add(
        "send-otp-job",
        { email: cleanEmail, code: otpCode, type },
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: true,
          removeOnFail: 100,
        },
      );
      console.log(`[QUEUE] Đã đẩy job gửi OTP của ${cleanEmail} vào BullMQ`);
    } catch (queueErr: any) {
      // Queue lỗi → xóa OTP vừa tạo để user không bị kẹt cooldown
      await prisma.oTP.delete({ where: { id: newOtp.id } }).catch(() => {});
      console.error("[QUEUE] Đẩy job thất bại:", queueErr.message);
      const error: any = new Error(
        "Không gửi được mã OTP, vui lòng thử lại sau ít phút!",
      );
      error.statusCode = 503;
      throw error;
    }

    // Chỉ trả field an toàn, KHÔNG trả `code` cho client
    return {
      email: newOtp.email,
      type: newOtp.type,
      expiredAt: newOtp.expiredAt,
    };
  }

  /**
   * Verify OTP với giới hạn 5 lần nhập sai (dùng DB attempts).
   * Sai quá 5 lần → xóa OTP, yêu cầu mã mới.
   */
  static async verifyOTPLogic(
    email: string,
    code: string,
    type: "REGISTER" | "FORGOT_PASSWORD" = "REGISTER",
  ): Promise<boolean> {
    const cleanEmail = email.toLowerCase().trim();
    const cleanCode = code.trim();

    // Lấy OTP mới nhất của email + type (bất kể code đúng/sai)
    const otpRecord = await prisma.oTP.findFirst({
      where: { email: cleanEmail, type: type as any },
      orderBy: { createAt: "desc" },
    });

    if (!otpRecord) {
      const error: any = new Error("Mã OTP không chính xác hoặc đã hết hạn!");
      error.statusCode = 400;
      throw error;
    }

    // Chặn brute-force: đã sai quá 5 lần
    if (otpRecord.attempts >= MAX_ATTEMPTS) {
      await prisma.oTP.deleteMany({
        where: { email: cleanEmail, type: type as any },
      });
      const error: any = new Error(
        `Bạn đã nhập sai quá ${MAX_ATTEMPTS} lần. Vui lòng yêu cầu mã OTP mới!`,
      );
      error.statusCode = 429;
      throw error;
    }

    // Kiểm tra hết hạn
    if (new Date() > otpRecord.expiredAt) {
      const error: any = new Error("Mã OTP đã hết hạn!");
      error.statusCode = 400;
      throw error;
    }

    // Mã sai → tăng attempts
    if (otpRecord.code !== cleanCode) {
      await prisma.oTP.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      });
      const remaining = MAX_ATTEMPTS - otpRecord.attempts - 1;
      const error: any = new Error(
        `Mã OTP không chính xác! Còn ${remaining} lần thử.`,
      );
      error.statusCode = 400;
      throw error;
    }

    // Xác thực thành công → xóa OTP
    await prisma.oTP.deleteMany({
      where: { email: cleanEmail, type: type as any },
    });

    return true;
  }
}
