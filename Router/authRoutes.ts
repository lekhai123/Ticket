import { Router } from "express";
import { UserController } from "../Controller/userController";
import { AuthController } from "../Controller/authController";
import { WebAuthnController } from "../Controller/webauthnController"; // Import mới
import { validate } from "../Middleware/validateMiddleware";
import { authenticateToken } from "../Middleware/authMiddleware";
import { checkIpBlacklist } from "../Middleware/ipGuard";

import {
  loginSchema,
  requestOtpSchema,
  completeRegisterSchema,
  resetPasswordSchema,
} from "../Validation/authValidation";

const router = Router();

// ==========================================
// WEBAUTHN (PASSKEY) ROUTES - TÍNH NĂNG MỚI
// ==========================================
// Đăng nhập bằng vân tay (Không cần đăng nhập trước)
router.post(
  "/webauthn/login/generate",
  checkIpBlacklist,
  WebAuthnController.generateAuthentication,
);
router.post(
  "/webauthn/login/verify",
  checkIpBlacklist,
  WebAuthnController.verifyAuthentication,
);

// Đăng ký cài đặt vân tay (Bắt buộc phải đăng nhập bằng pass trước)
router.get(
  "/webauthn/register/generate",
  authenticateToken,
  WebAuthnController.generateRegistration,
);
router.post(
  "/webauthn/register/verify",
  authenticateToken,
  WebAuthnController.verifyRegistration,
);

// ==========================================
// CÁC ROUTE CŨ GIỮ NGUYÊN
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
router.post("/refresh-token", checkIpBlacklist, AuthController.refreshToken);
router.post("/logout", AuthController.logout);
router.get("/me", authenticateToken, UserController.getMe);

export default router;
