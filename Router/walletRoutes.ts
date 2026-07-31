import { Router } from "express";
import { WalletController } from "../Controller/walletController";
import { validate } from "../Middleware/validateMiddleware";
import { idempotency } from "../Middleware/idempotencyMiddleware";
import {
  topUpWalletSchema,
  getUserWalletSchema,
  getWalletTransactionsSchema,
} from "../Validation/walletValidation";

const router = Router();

// POST /api/wallets/:userId/topup - Nạp tiền vào ví (Atomic increment)
router.post(
  "/:userId/topup",
  idempotency(86400),
  validate(topUpWalletSchema),
  WalletController.topUp,
);

// GET /api/wallets/:userId - Xem số dư ví
router.get(
  "/:userId",
  validate(getUserWalletSchema),
  WalletController.getBalance,
);
router.get(
  "/:userId/transactions",
  validate(getWalletTransactionsSchema),
  WalletController.getTransactions,
);

export default router;
