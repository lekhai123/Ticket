// FILE: Router/adminRoutes.ts
import type { Request, Response } from "express";
import { Router } from "express";
import { validate } from "../Middleware/validateMiddleware";
// 🎯 Import cặp Middleware chuẩn từ authMiddleware
import { authenticateToken, requireAdmin } from "../Middleware/authMiddleware";
import { AdminController } from "../Controller/adminController";
import { RevocationService } from "../Service/revocationService";
import { ReconciliationService } from "../Service/reconciliationService";
import { unlockWallet } from "../Controller/adminController";
import {
  getStatsSchema,
  getUsersSchema,
  massGiftSchema,
  getAuditLogsSchema,
  getHealthSchema,
} from "../Validation/adminValidation";

const router = Router();

router.get(
  "/dashboard-stats",
  validate(getStatsSchema),
  AdminController.getStats,
);

router.get("/users", validate(getUsersSchema), AdminController.getUsers);

router.post(
  "/mass-gift",
  authenticateToken,
  validate(massGiftSchema),
  AdminController.massGift,
);

router.get(
  "/system-health",
  validate(getHealthSchema),
  AdminController.getHealth,
);

router.get(
  "/audit-logs",
  validate(getAuditLogsSchema),
  AdminController.getAuditLogs,
);

router.post("/revoke-batch", async (req, res, next) => {
  try {
    const { batchId, adminUserId } = req.body;
    const result = await RevocationService.revokeBatch(
      batchId,
      Number(adminUserId),
    );
    res
      .status(200)
      .json({ success: true, message: "Thu hồi thành công!", data: result });
  } catch (error) {
    next(error);
  }
});

router.post("/reconciliation/trigger", async (req: Request, res: Response) => {
  try {
    const report = await ReconciliationService.runDailyReconciliation();
    return res.status(200).json({
      success: true,
      message: "Đã hoàn thành tiến trình kiểm tra đối soát tài chính.",
      data: report,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi thực hiện đối soát.",
      error: error.message,
    });
  }
});

// 🎯 ROUTE MỞ KHÓA VÍ: Thay verifyToken bằng authenticateToken + requireAdmin
router.patch(
  "/wallets/:userId/unlock",
  authenticateToken,
  requireAdmin,
  unlockWallet,
);

export default router;
