import { Router } from "express";
import { UserController } from "../Controller/userController";
import { AuthController } from "../Controller/authController";
import { validate } from "../Middleware/validateMiddleware";
import { authenticateToken } from "../Middleware/authMiddleware";

import {
  loginSchema,
  registerSchema,
  requestOtpSchema,
  completeRegisterSchema,
  resetPasswordSchema,
} from "../Validation/authValidation";

const router = Router();

// 1. Đăng nhập
router.post("/login", validate(loginSchema), AuthController.login);

// 2. Lấy thông tin user hiện tại (Token Auth)
router.get("/me", authenticateToken, UserController.getMe);

// 3. Yêu cầu gửi mã OTP (Dùng cho cả Đăng ký & Quên mật khẩu)
router.post(
  "/request-otp",
  validate(requestOtpSchema),
  AuthController.requestOtp,
);

// 4. Đăng ký tài khoản hoàn tất (Yêu cầu xác nhận OTP)
router.post(
  "/register",
  validate(completeRegisterSchema),
  AuthController.completeRegister,
);

// 5. Đặt lại / Khôi phục mật khẩu (Dành cho Quên mật khẩu)
router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  AuthController.resetPassword,
);
router.post("/refresh-token", AuthController.refreshToken);
router.post("/logout", AuthController.logout);

export default router;
