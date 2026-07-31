import type { Request, Response } from "express";
import { OtpService } from "../Service/otpService";

export class OtpController {
  static async sendOTP(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(400).json({
          success: false,
          message: "Email is required",
        });
        return;
      }
      const otpData = await OtpService.createOTPLogic(email);
      res.status(200).json({
        success: true,
        message: "OTP sent successfully",
        data: {
          email: otpData.email,
          code: otpData.code,
          expiredAt: otpData.expiredAt,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
  static async verifyOTP(req: Request, res: Response): Promise<void> {
    const { email, code } = req.body;

    // Gọi service xử lý logic so khớp
    await OtpService.verifyOTPLogic(email, code);

    res.status(200).json({
      success: true,
      message: "Xác thực OTP thành công!",
    });
  }
}
