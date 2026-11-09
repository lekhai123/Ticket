import { Router } from "express";
import { validate } from "../Middleware/validateMiddleware";
import { authenticateToken, requireAdmin } from "../Middleware/authMiddleware";
import { AdminController } from "../Controller/adminController";
import { RevocationService } from "../Service/revocationService";
import { ReconciliationService } from "../Service/reconciliationService";
import { TicketService } from "../Service/ticketService";
import { rateLimit } from "../Middleware/rateLimitMiddleware";
import prisma from "../database/prismaClient";
import { initAnalyticsCron } from "../jobs/analyticsJob";
import {
  getStatsSchema,
  getUsersSchema,
  massGiftSchema,
  getAuditLogsSchema,
  getHealthSchema,
} from "../Validation/adminValidation";

const router = Router();

// Bảo vệ toàn bộ route Admin
router.use(authenticateToken, requireAdmin);

// Giới hạn chung cho Admin: 60 req/phút (Tránh việc spam F5 làm sập DB)
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

// Cron jobs (Bảo vệ bằng CRON_SECRET, đã chặn bot)
router.get("/cron/ticket-auditor", async (req, res) => {
  console.log("=> CLIENT GỬI:", `[${req.headers.authorization}]`);
  console.log("=> SERVER MONG ĐỢI:", `[Bearer ${process.env.CRON_SECRET}]`);
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`)
    return res.status(401).json({ error: "Unauthorized" });
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
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`)
    return res.status(401).json({ error: "Unauthorized" });
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
router.get("/cron/analytics", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW revenue_stats;`);
    return res.json({ success: true, message: "Đã làm mới bảng thống kê" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
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
      message: "Đã hoàn thành đối soát.",
      data: report,
    });
  } catch (error: any) {
    return res
      .status(500)
      .json({ success: false, message: "Lỗi đối soát.", error: error.message });
  }
});

router.patch("/wallets/:userId/unlock", AdminController.unlockWallet);

export default router;
