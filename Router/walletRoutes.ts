import { Router } from "express";
import { WalletController } from "../Controller/walletController";
import { validate } from "../Middleware/validateMiddleware";
import { idempotency } from "../Middleware/idempotencyMiddleware";
import { authenticateToken, requireAdmin } from "../Middleware/authMiddleware"; // Thêm vào
import {
  topUpWalletSchema,
  getUserWalletSchema,
  getWalletTransactionsSchema,
} from "../Validation/walletValidation";

const router = Router();

// BẮT BUỘC ĐĂNG NHẬP VÀ LÀ ADMIN MỚI ĐƯỢC NẠP TIỀN
router.post(
  "/:userId/topup",
  authenticateToken,
  requireAdmin,
  idempotency(86400),
  validate(topUpWalletSchema),
  WalletController.topUp,
);

// YÊU CẦU ĐĂNG NHẬP ĐỂ XEM SỐ DƯ & LỊCH SỬ
router.get(
  "/:userId",
  authenticateToken,
  validate(getUserWalletSchema),
  WalletController.getBalance,
);

router.get(
  "/:userId/transactions",
  authenticateToken,
  validate(getWalletTransactionsSchema),
  WalletController.getTransactions,
);

export default router;
