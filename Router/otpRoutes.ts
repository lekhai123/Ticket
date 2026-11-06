import { Router } from "express";
import { OtpController } from "../Controller/otpController";
import { validate } from "../Middleware/validateMiddleware";
import { checkIpBlacklist } from "../Middleware/ipGuard"; // Thêm IP Guard
import { verifyOTPSchema } from "../Validation/otpValidation";

const router = Router();

// Gắn checkIpBlacklist để tránh bị spam gửi OTP
router.post("/send", checkIpBlacklist, OtpController.sendOTP);
router.post(
  "/verify",
  checkIpBlacklist,
  validate(verifyOTPSchema),
  OtpController.verifyOTP,
);

export default router;
