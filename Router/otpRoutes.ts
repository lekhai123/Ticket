// FILE: Router/otpRoutes.ts
import { Router } from "express";
import { OtpController } from "../Controller/otpController";
import { validate } from "../Middleware/validateMiddleware";
import { verifyOTPSchema } from "../Validation/otpValidation";

const router = Router();

// Route 1: Tạo và gửi mã OTP (Bạn có thể bổ sung validate schema cho create nếu cần)
router.post("/send", OtpController.sendOTP);

// Route 2: Xác thực mã OTP (Có đi qua validate middleware chặn trước)
router.post("/verify", validate(verifyOTPSchema), OtpController.verifyOTP);

export default router;
