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
import { TicketService } from "../Service/ticketService";

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
router.get("/tickets", AdminController.getTickets);
router.get("/tickets/scan", AdminController.scanTickets);
router.get("/cron/ticket-auditor", async (req, res) => {
  // Bảo mật: Chỉ Vercel mới được gọi (thông qua biến CRON_SECRET)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const result = await TicketService.scanAnomalies(); // Gọi hàm quét AI của bạn
    return res.json({
      success: true,
      anomaliesFound: (result.anomalies as any[]).length,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});
router.get("/cron/reconciliation", async (req, res) => {
  // Bảo mật: Chỉ Vercel mới được gọi
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const result = await ReconciliationService.runDailyReconciliation();
    return res.json({
      success: true,
      checked: result.totalWalletsChecked,
      mismatches: result.mismatchCount,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});
router.post("/bookings/:ticketId/revoke", AdminController.revokeSingleTicket);
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
