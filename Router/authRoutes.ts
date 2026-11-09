import { Router } from "express";
import { UserController } from "../Controller/userController";
import { AuthController } from "../Controller/authController";
import { WebAuthnController } from "../Controller/webauthnController";
import { validate } from "../Middleware/validateMiddleware";
import { authenticateToken } from "../Middleware/authMiddleware";
import { checkIpBlacklist } from "../Middleware/ipGuard";
import { rateLimit } from "../Middleware/rateLimitMiddleware";

import {
  loginSchema,
  requestOtpSchema,
  completeRegisterSchema,
  resetPasswordSchema,
} from "../Validation/authValidation";

const router = Router();

// ==========================================
// WEBAUTHN (PASSKEY) ROUTES
// ==========================================
router.post(
  "/webauthn/login/generate",
  checkIpBlacklist,
  rateLimit(10, 60), //  Tối đa 10 lần / phút
  WebAuthnController.generateAuthentication,
);
router.post(
  "/webauthn/login/verify",
  checkIpBlacklist,
  rateLimit(10, 60),
  WebAuthnController.verifyAuthentication,
);
router.get(
  "/webauthn/register/generate",
  authenticateToken,
  rateLimit(5, 60),
  WebAuthnController.generateRegistration,
);
router.post(
  "/webauthn/register/verify",
  authenticateToken,
  rateLimit(5, 60),
  WebAuthnController.verifyRegistration,
);

// ==========================================
// CÁC ROUTE XÁC THỰC CƠ BẢN
// ==========================================
router.post(
  "/login",
  checkIpBlacklist,
  rateLimit(5, 60), //  Chỉ cho phép 5 lần đăng nhập / phút (Chống brute-force)
  validate(loginSchema),
  AuthController.login,
);
router.post(
  "/request-otp",
  checkIpBlacklist,
  rateLimit(3, 60), // Chỉ cho phép 3 lần yêu cầu OTP / phút (Chống spam)
  validate(requestOtpSchema),
  AuthController.requestOtp,
);
router.post(
  "/register",
  checkIpBlacklist,
  rateLimit(3, 60), // Chống tạo acc ảo
  validate(completeRegisterSchema),
  AuthController.completeRegister,
);
router.post(
  "/reset-password",
  checkIpBlacklist,
  rateLimit(3, 60),
  validate(resetPasswordSchema),
  AuthController.resetPassword,
);
router.post(
  "/refresh-token",
  checkIpBlacklist,
  rateLimit(20, 60), // Refresh token được phép gọi nhiều hơn một chút
  AuthController.refreshToken,
);
router.post("/logout", rateLimit(10, 60), AuthController.logout);
router.get("/me", authenticateToken, UserController.getMe);

export default router;
