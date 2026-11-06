import { Router } from "express";
import { validate } from "../Middleware/validateMiddleware";
import { authenticateToken, requireAdmin } from "../Middleware/authMiddleware";
import { AdminController } from "../Controller/adminController"; // Chỉ cần import mỗi class này
import { RevocationService } from "../Service/revocationService";
import { ReconciliationService } from "../Service/reconciliationService";
import {
  getStatsSchema,
  getUsersSchema,
  massGiftSchema,
  getAuditLogsSchema,
  getHealthSchema,
} from "../Validation/adminValidation";

const router = Router();

// Mọi request vào /api/admin đều phải đăng nhập và là ADMIN
router.use(authenticateToken, requireAdmin);

router.get(
  "/dashboard-stats",
  validate(getStatsSchema),
  AdminController.getStats,
);
router.get("/users", validate(getUsersSchema), AdminController.getUsers);
router.post("/mass-gift", validate(massGiftSchema), AdminController.massGift);
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
    const { batchId } = req.body;
    const adminUserId = (req as any).user?.id || (req as any).user?.userId;

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

router.post("/reconciliation/trigger", async (req, res) => {
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

// Gọi qua class thay vì import lẻ
router.patch("/wallets/:userId/unlock", AdminController.unlockWallet);

export default router;
