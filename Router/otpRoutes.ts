import { Router } from "express";
import { OtpController } from "../Controller/otpController";
import { validate } from "../Middleware/validateMiddleware";
import { checkIpBlacklist } from "../Middleware/ipGuard";
import { rateLimit } from "../Middleware/rateLimitMiddleware";
import { verifyOTPSchema } from "../Validation/otpValidation";

const router = Router();

router.post(
  "/send",
  checkIpBlacklist,
  rateLimit(3, 60), // 3 lần gửi OTP / phút
  OtpController.sendOTP,
);
router.post(
  "/verify",
  checkIpBlacklist,
  rateLimit(5, 60), // 5 lần nhập OTP / phút (Chống dò mã)
  validate(verifyOTPSchema),
  OtpController.verifyOTP,
);

export default router;
