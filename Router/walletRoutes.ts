import { Router } from "express";
import { WalletController } from "../Controller/walletController";
import { validate } from "../Middleware/validateMiddleware";
import { idempotency } from "../Middleware/idempotencyMiddleware";
import { authenticateToken, requireAdmin } from "../Middleware/authMiddleware";
import { rateLimit } from "../Middleware/rateLimitMiddleware";
import {
  topUpWalletSchema,
  getUserWalletSchema,
  getWalletTransactionsSchema,
} from "../Validation/walletValidation";

const router = Router();

router.post(
  "/:userId/topup",
  authenticateToken,
  requireAdmin,
  rateLimit(10, 60), // Chống Admin (hoặc bot lạm dụng quyền) spam nạp tiền
  idempotency(86400),
  validate(topUpWalletSchema),
  WalletController.topUp,
);

router.get(
  "/:userId",
  authenticateToken,
  rateLimit(30, 60),
  validate(getUserWalletSchema),
  WalletController.getBalance,
);

router.get(
  "/:userId/transactions",
  authenticateToken,
  rateLimit(20, 60),
  validate(getWalletTransactionsSchema),
  WalletController.getTransactions,
);

export default router;
