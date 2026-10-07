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

router.post(
  "/:userId/topup",
  idempotency(86400),
  validate(topUpWalletSchema),
  WalletController.topUp,
);

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
