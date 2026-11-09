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

router.post(
  "/webauthn/login/generate",
  checkIpBlacklist,
  rateLimit(30, 60),
  WebAuthnController.generateAuthentication,
);
router.post(
  "/webauthn/login/verify",
  checkIpBlacklist,
  rateLimit(30, 60),
  WebAuthnController.verifyAuthentication,
);
router.get(
  "/webauthn/register/generate",
  authenticateToken,
  rateLimit(20, 60),
  WebAuthnController.generateRegistration,
);
router.post(
  "/webauthn/register/verify",
  authenticateToken,
  rateLimit(20, 60),
  WebAuthnController.verifyRegistration,
);

router.post(
  "/login",
  checkIpBlacklist,
  rateLimit(20, 60),
  validate(loginSchema),
  AuthController.login,
);
router.post(
  "/request-otp",
  checkIpBlacklist,
  rateLimit(10, 60),
  validate(requestOtpSchema),
  AuthController.requestOtp,
);
router.post(
  "/register",
  checkIpBlacklist,
  rateLimit(10, 60),
  validate(completeRegisterSchema),
  AuthController.completeRegister,
);
router.post(
  "/reset-password",
  checkIpBlacklist,
  rateLimit(10, 60),
  validate(resetPasswordSchema),
  AuthController.resetPassword,
);
router.post(
  "/refresh-token",
  checkIpBlacklist,
  rateLimit(50, 60),
  AuthController.refreshToken,
);
router.post("/logout", rateLimit(30, 60), AuthController.logout);
router.get("/me", authenticateToken, UserController.getMe);

export default router;
