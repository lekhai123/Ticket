import { Router } from "express";
import { PaymentController } from "../Controller/paymentController";
import { authenticateToken } from "../Middleware/authMiddleware";
import { rateLimit } from "../Middleware/rateLimitMiddleware";
import { validate } from "../Middleware/validateMiddleware";
import { createTopUpSchema } from "../Validation/paymentValidation";
const router = Router();

router.post(
  "/create",
  authenticateToken,
  rateLimit(30, 60),
  validate(createTopUpSchema),
  PaymentController.createTopUp,
);
router.post("/webhook", rateLimit(100, 60), PaymentController.webhook);

export default router;
