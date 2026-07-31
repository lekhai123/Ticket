// FILE: Router/adminRoutes.ts
import { Router } from "express";
import { validate } from "../Middleware/validateMiddleware";
import { authenticateToken } from "../Middleware/authMiddleware";
import { AdminController } from "../Controller/adminController";
import { RevocationService } from "../Service/revocationService";
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

export default router;
