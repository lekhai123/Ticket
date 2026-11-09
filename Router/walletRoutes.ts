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
  rateLimit(30, 60),
  idempotency(86400),
  validate(topUpWalletSchema),
  WalletController.topUp,
);

router.get(
  "/:userId",
  authenticateToken,
  rateLimit(200, 60),
  validate(getUserWalletSchema),
  WalletController.getBalance,
);

router.get(
  "/:userId/transactions",
  authenticateToken,
  rateLimit(150, 60),
  validate(getWalletTransactionsSchema),
  WalletController.getTransactions,
);

export default router;
