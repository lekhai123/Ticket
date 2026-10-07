import { Router } from "express";
import { OtpController } from "../Controller/otpController";
import { validate } from "../Middleware/validateMiddleware";
import { verifyOTPSchema } from "../Validation/otpValidation";

const router = Router();

router.post("/send", OtpController.sendOTP);

router.post("/verify", validate(verifyOTPSchema), OtpController.verifyOTP);

export default router;
