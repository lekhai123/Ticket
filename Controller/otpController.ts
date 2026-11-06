import type { Request, Response, NextFunction } from "express";
import { OtpService } from "../Service/otpService";

const catchAsync =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export class OtpController {
  static sendOTP = catchAsync(async (req: Request, res: Response) => {
    const { email, type } = req.body;

    // OtpService đã trả về object an toàn (không có code)
    const otpData = await OtpService.createOTPLogic(email, type || "REGISTER");

    res.status(200).json({
      success: true,
      message: "Mã OTP đã được gửi đến email của bạn.",
      data: {
        email: otpData.email,
        expiredAt: otpData.expiredAt,
        // TUYỆT ĐỐI KHÔNG TRẢ CODE VỀ ĐÂY
      },
    });
  });

  static verifyOTP = catchAsync(async (req: Request, res: Response) => {
    const { email, code, type } = req.body;
    await OtpService.verifyOTPLogic(email, code, type || "REGISTER");
    res.status(200).json({
      success: true,
      message: "Xác thực OTP thành công!",
    });
  });
}
