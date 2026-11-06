import type { Request, Response } from "express";
import { AuthService } from "../Service/authService";
import { RevocationService } from "../Service/revocationService";

// Cấu hình chung cho Cookie chứa Refresh Token
const REFRESH_COOKIE_OPTS = {
  httpOnly: true, // Chống XSS
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
  path: "/api/auth", // Chỉ gửi cookie này đến các route auth
};

export class AuthController {
  /**
   * Đăng nhập: Gửi Refresh Token qua HttpOnly Cookie, Access Token qua JSON
   */
  static async login(req: Request, res: Response) {
    try {
      const result = await AuthService.login(req.body);
      const { refreshToken, accessToken, user } = result;

      // Set Refresh Token vào Cookie
      res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTS);

      return res.json({
        success: true,
        message: "Đăng nhập thành công!",
        data: {
          user,
          accessToken,
        },
      });
    } catch (err: any) {
      return res.status(err.statusCode || 400).json({
        success: false,
        message: err.message || "Đăng nhập thất bại",
      });
    }
  }

  /**
   * Cấp lại Access Token mới dựa vào Refresh Token trong Cookie
   */
  static async refreshToken(req: Request, res: Response) {
    try {
      const refreshToken = req.cookies?.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: "Không tìm thấy phiên làm việc! Vui lòng đăng nhập lại.",
        });
      }

      // Service trả về { accessToken, refreshToken, user }
      const result = await AuthService.refreshToken(refreshToken);

      // Ghi đè Refresh Token mới vào Cookie (bắt buộc do cơ chế rotation)
      res.cookie("refreshToken", result.refreshToken, REFRESH_COOKIE_OPTS);

      return res.status(200).json({
        success: true,
        data: {
          accessToken: result.accessToken,
          user: result.user,
        },
      });
    } catch (err: any) {
      // Xóa cookie nếu refresh token không hợp lệ để buộc đăng nhập lại
      res.clearCookie("refreshToken", { ...REFRESH_COOKIE_OPTS, maxAge: 0 });

      return res.status(err.statusCode || 401).json({
        success: false,
        message: err.message || "Phiên làm việc đã hết hạn!",
      });
    }
  }

  /**
   * Đăng xuất: Thu hồi token trên server và Xóa Cookie
   */
  static async logout(req: Request, res: Response) {
    try {
      const accessToken = req.headers.authorization?.split(" ")[1];
      const refreshToken = req.cookies?.refreshToken;

      // Đưa cả Access và Refresh Token vào danh sách đen
      await RevocationService.revokePair(accessToken, refreshToken);

      // Xóa cookie
      res.clearCookie("refreshToken", { ...REFRESH_COOKIE_OPTS, maxAge: 0 });

      return res.json({
        success: true,
        message: "Đăng xuất thành công!",
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message || "Lỗi khi đăng xuất",
      });
    }
  }

  /**
   * Đăng ký thông thường
   */
  static async register(req: Request, res: Response) {
    try {
      const newUser = await AuthService.register(req.body);
      return res.status(201).json({
        success: true,
        message: "Đăng ký thành công!",
        data: newUser,
      });
    } catch (err: any) {
      return res.status(err.statusCode || 400).json({ message: err.message });
    }
  }

  /**
   * Yêu cầu gửi OTP
   */
  static async requestOtp(req: Request, res: Response) {
    try {
      const { email, type } = req.body;
      await AuthService.requestOtp(email, type);
      return res.json({
        success: true,
        message: "Mã OTP đã được gửi đến email của bạn.",
      });
    } catch (err: any) {
      return res.status(err.statusCode || 400).json({ message: err.message });
    }
  }

  /**
   * Đăng ký hoàn tất kèm OTP
   */
  static async completeRegister(req: Request, res: Response) {
    try {
      const newUser = await AuthService.completeRegister(req.body);
      return res.status(201).json({
        success: true,
        message: "Đăng ký tài khoản thành công!",
        userId: newUser.id,
      });
    } catch (err: any) {
      return res.status(err.statusCode || 400).json({ message: err.message });
    }
  }

  /**
   * Đặt lại mật khẩu bằng OTP
   */
  static async resetPassword(req: Request, res: Response) {
    try {
      await AuthService.resetPassword(req.body);
      return res.json({
        success: true,
        message: "Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại.",
      });
    } catch (err: any) {
      return res.status(err.statusCode || 400).json({ message: err.message });
    }
  }
}
