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
  rateLimit(10, 60),
  OtpController.sendOTP,
);
router.post(
  "/verify",
  checkIpBlacklist,
  rateLimit(20, 60),
  validate(verifyOTPSchema),
  OtpController.verifyOTP,
);

export default router;
