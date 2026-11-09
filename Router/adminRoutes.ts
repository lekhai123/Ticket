import { Router } from "express";
import { validate } from "../Middleware/validateMiddleware";
import { authenticateToken, requireAdmin } from "../Middleware/authMiddleware";
import { AdminController } from "../Controller/adminController";
import { RevocationService } from "../Service/revocationService";
import { ReconciliationService } from "../Service/reconciliationService";
import { TicketService } from "../Service/ticketService";
import { rateLimit } from "../Middleware/rateLimitMiddleware";
import prisma from "../database/prismaClient";
import {
  getStatsSchema,
  getUsersSchema,
  massGiftSchema,
  getAuditLogsSchema,
  getHealthSchema,
} from "../Validation/adminValidation";

const router = Router();

// ==========================================
// 1. CRON JOBS (ĐẶT TRÊN CÙNG ĐỂ KHÔNG BỊ DÍNH JWT)
// ==========================================
router.get("/cron/ticket-auditor", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const result = await TicketService.scanAnomalies();
    return res.json({
      success: true,
      anomaliesFound: (result.anomalies as any[]).length,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/cron/reconciliation", async (req, res) => {
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
router.get("/cron/refresh-analytics", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Câu lệnh làm mới Materialized View
    await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW revenue_stats;`);
    return res.json({
      success: true,
      message: "Đã làm mới bảng thống kê doanh thu (Materialized View)!",
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 2. ADMIN ROUTES (BẮT BUỘC PHẢI CÓ JWT)
// ==========================================
// Từ đây trở xuống, mọi request đều phải verify JWT
router.use(authenticateToken, requireAdmin);

// Rate limit chung cho Admin (60 req/phút)
router.use(rateLimit(60, 60));

router.get(
  "/dashboard-stats",
  validate(getStatsSchema),
  AdminController.getStats,
);
router.get("/users", validate(getUsersSchema), AdminController.getUsers);
router.post(
  "/mass-gift",
  rateLimit(5, 60),
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
router.get("/tickets", AdminController.getTickets);
router.get("/tickets/scan", rateLimit(10, 60), AdminController.scanTickets);

router.post("/revoke-batch", rateLimit(5, 60), async (req, res, next) => {
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

router.post(
  "/bookings/:ticketId/revoke",
  rateLimit(10, 60),
  AdminController.revokeSingleTicket,
);

router.post("/reconciliation/trigger", rateLimit(3, 60), async (req, res) => {
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

router.patch("/wallets/:userId/unlock", AdminController.unlockWallet);

export default router;
