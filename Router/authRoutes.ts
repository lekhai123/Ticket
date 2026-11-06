import { Router } from "express";
import { UserController } from "../Controller/userController";
import { AuthController } from "../Controller/authController";
import { validate } from "../Middleware/validateMiddleware";
import { authenticateToken } from "../Middleware/authMiddleware";
import { checkIpBlacklist } from "../Middleware/ipGuard"; // Thêm bảo vệ IP

import {
  loginSchema,
  registerSchema,
  requestOtpSchema,
  completeRegisterSchema,
  resetPasswordSchema,
} from "../Validation/authValidation";

const router = Router();

// ==========================================
// NHÓM 1: CÁC ROUTE CÔNG KHAI (Cần chặn IP xấu/spam)
// ==========================================

router.post(
  "/login",
  checkIpBlacklist,
  validate(loginSchema),
  AuthController.login,
);

router.post(
  "/request-otp",
  checkIpBlacklist,
  validate(requestOtpSchema),
  AuthController.requestOtp,
);

router.post(
  "/register",
  checkIpBlacklist,
  validate(completeRegisterSchema),
  AuthController.completeRegister,
);

router.post(
  "/reset-password",
  checkIpBlacklist,
  validate(resetPasswordSchema),
  AuthController.resetPassword,
);

// ==========================================
// NHÓM 2: QUẢN LÝ TOKEN (Cần IP Guard nhưng không cần Access Token)
// ==========================================

// Dùng cookie (refreshToken) để gia hạn, không cần gửi Access Token
router.post("/refresh-token", checkIpBlacklist, AuthController.refreshToken);

// Không dùng authenticateToken ở đây để user vẫn logout được khi Access Token đã hết hạn
router.post("/logout", AuthController.logout);

// ==========================================
// NHÓM 3: YÊU CẦU BẢO MẬT CAO (Bắt buộc phải có Access Token)
// ==========================================

router.get("/me", authenticateToken, UserController.getMe);

export default router;
