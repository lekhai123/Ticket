// FILE: Services/otpService.ts
import prisma from "../database/prismaClient";
import { sendOtpEmail } from "../config/resend"; // 👈 Import hàm bạn đã viết sẵn trong resend.ts
import { mailQueue } from "../queues/mailQueue";
import crypto from "crypto";

export class OtpService {
  static async createOTPLogic(
    email: string,
    type: "REGISTER" | "FORGOT_PASSWORD" = "REGISTER",
  ) {
    const cleanEmail = email.toLowerCase().trim();
    const now = new Date();

    // Check Cooldown 1 phút chống spam
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

    // Sinh mã OTP 6 chữ số
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const expiredAt = new Date(now.getTime() + 5 * 60 * 1000);

    await prisma.oTP.deleteMany({
      where: { email: cleanEmail, type: type as any },
    });

    const newOtp = await prisma.oTP.create({
      data: {
        email: cleanEmail,
        code: otpCode,
        type: type as any,
        expiredAt,
      },
    });

    // 🎯 PUSH JOB VÀO QUEUE THAY VÌ GỬI TRỰC TIẾP (Async Producer)
    await mailQueue.add(
      "send-otp-job",
      { email: cleanEmail, code: otpCode, type },
      {
        // 🔄 Tự động thử lại 3 lần nếu gặp lỗi kết nối/Resend sập, thời gian chờ tăng dần (Exponential Backoff)
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000, // Thử lại sau 2s, 4s, 8s...
        },
        removeOnComplete: true, // Tự động dọn dẹp job thành công khỏi Redis
        removeOnFail: 100, // Giữ tối đa 100 job lỗi để debug
      },
    );

    console.log(
      `📥 [QUEUE PRODUCER]: Đã đẩy Job gửi OTP của ${cleanEmail} vào BullMQ`,
    );

    return newOtp;
  }
  /**
   * 🎯 2. Verify mã OTP
   */
  static async verifyOTPLogic(
    email: string,
    code: string,
    type: "REGISTER" | "FORGOT_PASSWORD" = "REGISTER",
  ): Promise<boolean> {
    const cleanEmail = email.toLowerCase().trim();
    const cleanCode = code.trim();

    const otpRecord = await prisma.oTP.findFirst({
      where: {
        email: cleanEmail,
        code: cleanCode,
        type: type as any,
      },
      orderBy: { createAt: "desc" },
    });

    if (!otpRecord) {
      const error = new Error("Mã OTP không chính xác!") as any;
      error.statusCode = 400;
      throw error;
    }

    if (new Date() > otpRecord.expiredAt) {
      const error = new Error("Mã OTP đã hết hạn!") as any;
      error.statusCode = 400;
      throw error;
    }

    // Xác thực thành công -> Xóa mã này
    await prisma.oTP.deleteMany({
      where: { email: cleanEmail, type: type as any },
    });

    return true;
  }
}
