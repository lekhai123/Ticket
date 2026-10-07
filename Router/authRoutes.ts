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

router.post("/login", validate(loginSchema), AuthController.login);

router.get("/me", authenticateToken, UserController.getMe);

router.post(
  "/request-otp",
  validate(requestOtpSchema),
  AuthController.requestOtp,
);

router.post(
  "/register",
  validate(completeRegisterSchema),
  AuthController.completeRegister,
);

router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  AuthController.resetPassword,
);
router.post("/refresh-token", AuthController.refreshToken);
router.post("/logout", AuthController.logout);

export default router;
