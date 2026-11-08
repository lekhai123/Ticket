// Router/paymentRoutes.ts
import { Router } from "express";
import { PaymentController } from "../Controller/paymentController";
import { authenticateToken } from "../Middleware/authMiddleware";

const router = Router();

// API cho Frontend gọi
router.post("/create", authenticateToken, PaymentController.createTopUp);

// API cho PayOS gọi (Không cần Auth Token, nhưng có Verify Signature bên trong)
router.post("/webhook", PaymentController.webhook);

export default router;
