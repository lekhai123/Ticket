import { Router } from "express";
import { PaymentController } from "../Controller/paymentController";
import { authenticateToken } from "../Middleware/authMiddleware";
import { rateLimit } from "../Middleware/rateLimitMiddleware";

const router = Router();

router.post(
  "/create",
  authenticateToken,
  rateLimit(5, 60), // 5 lần tạo link thanh toán / phút
  PaymentController.createTopUp,
);

// Webhook của PayOS (PayOS gọi, không cần auth nhưng cần rate limit nhẹ để chống spam webhook giả)
router.post("/webhook", rateLimit(30, 60), PaymentController.webhook);

export default router;
