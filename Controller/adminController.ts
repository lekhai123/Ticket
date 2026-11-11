import type { Request, Response, NextFunction } from "express";
import { AdminService } from "../Service/adminService";
import prisma from "../database/prismaClient";
import { TicketService } from "../Service/ticketService";
import { BookingService } from "../Service/bookingService";
import { MultiLevelCache } from "../Service/cacheService";
// FIX LỖI ESM: Import thay vì require
import { redisPrimary } from "../Utils/redisLock";
const catchAsync =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export class AdminController {
  static getStats = catchAsync(async (req: Request, res: Response) => {
    const stats = await AdminService.getSystemStats();
    res.status(200).json({ success: true, data: stats });
  });
  static getTickets = catchAsync(async (req: Request, res: Response) => {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 15;
    const search = req.query.search ? String(req.query.search) : undefined;

    const result = await TicketService.getAllTicketsForAdmin(
      page,
      limit,
      search,
    );
    res
      .status(200)
      .json({ success: true, data: result.data, meta: result.meta });
  });
  static getAIAlerts = catchAsync(async (req: Request, res: Response) => {
    const alerts = await prisma.auditLog.findMany({
      where: { action: "AI_ANOMALY_ALERT" },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    res.status(200).json({ success: true, data: alerts });
  });
  static scanTickets = catchAsync(async (req: Request, res: Response) => {
    const result = await TicketService.scanAnomalies();
    res.status(200).json({ success: true, data: result });
  });
  static revokeAnomalyTickets = catchAsync(
    async (req: Request, res: Response) => {
      const adminUserId = (req as any).user?.id || (req as any).user?.userId;
      const { reason } = req.body;

      // 1. Tự động tìm tất cả vé lỗi giá khá khác gốc
      const anomalies: any[] = await prisma.$queryRaw`
      SELECT t.id 
      FROM "Tickets" t
      JOIN "Trips" tr ON t."tripId" = tr.id
      WHERE t.status = 'CONFIRMED' 
        AND (
          t."paidAmount" IS NULL 
          OR t."paidAmount" != tr.price
        )
    `;

      if (!anomalies || anomalies.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Không tìm thấy vé lỗi nào để thu hồi!",
        });
      }

      const ticketIds = anomalies.map((a) => a.id);
      const finalReason = reason
        ? String(reason).trim()
        : "Hệ thống thu hồi vé lỗi giá 0đ";

      // 2. Gọi hàm thu hồi hàng loạt
      // Hàm này tự động gom nhóm theo User để hoàn tiền và gửi mail
      const result = await BookingService.adminRevokeMultipleTickets(
        ticketIds,
        Number(adminUserId),
        finalReason,
      );

      res.status(200).json({
        success: true,
        message: `Đã tự động thu hồi thành công ${result.count} vé lỗi!`,
        data: result,
      });
    },
  );

  // FIX: truyền đủ 3 tham số (ticketId, adminUserId, reason)
  static revokeSingleTicket = catchAsync(
    async (req: Request, res: Response) => {
      const ticketId = Number(req.params.ticketId);
      const { reason } = req.body;
      const adminUserId = (req as any).user?.id || (req as any).user?.userId;

      if (!ticketId || isNaN(ticketId)) {
        return res
          .status(400)
          .json({ success: false, message: "Mã vé không hợp lệ!" });
      }

      if (!adminUserId || isNaN(Number(adminUserId))) {
        return res
          .status(401)
          .json({ success: false, message: "Không xác định được Admin!" });
      }

      const finalReason = reason
        ? String(reason).trim()
        : "Admin thu hồi vé lẻ";

      const result = await BookingService.adminRevokeTicket(
        ticketId,
        Number(adminUserId),
        finalReason,
      );

      res.status(200).json({
        success: true,
        message: "Đã thu hồi vé thành công!",
        data: result,
      });
    },
  );

  static getUsers = catchAsync(async (req: Request, res: Response) => {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const search = req.query.search ? String(req.query.search) : undefined;

    const result = await AdminService.getAllUsers({
      page,
      limit,
      ...(search && { search }),
    });

    res.status(200).json({ success: true, data: result });
  });

  static massGift = catchAsync(async (req: Request, res: Response) => {
    const user = (req as any).user;
    const adminUserId = user?.id || user?.userId;

    const { amount, batchId, targetType, targetId, reason } = req.body;

    const result = await AdminService.executeMassGift({
      adminUserId: Number(adminUserId),
      amount: Number(amount),
      batchId,
      targetType,
      targetId,
      reason,
    });

    res.status(200).json({
      success: true,
      message: `Phát quà thành công cho ${result.totalUsersGifted} người dùng!`,
      data: result,
    });
  });

  static getAuditLogs = catchAsync(async (req: Request, res: Response) => {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 15;
    const batchId = req.query.batchId ? String(req.query.batchId) : undefined;
    const action = req.query.action ? String(req.query.action) : undefined;
    const userId = req.query.userId ? Number(req.query.userId) : undefined;

    const result = await AdminService.getAuditLogs({
      page,
      limit,
      ...(batchId && { batchId }),
      ...(action && { action }),
      ...(userId && { userId }),
    });

    res.status(200).json({ success: true, data: result });
  });

  static getHealth = catchAsync(async (req: Request, res: Response) => {
    const healthData = await AdminService.getHealthStatus();
    const isHealthy = healthData.database.status === "HEALTHY";

    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      data: healthData,
    });
  });
  static getPublicHealth = catchAsync(async (req: Request, res: Response) => {
    // 1. Kiểm tra cache của Public (TTL 30s) để chặn spam đốt quota
    const cacheKey = "public:system_status";
    const cachedStatus = await MultiLevelCache.get<any>(cacheKey);

    if (cachedStatus) {
      return res.status(200).json({ success: true, data: cachedStatus });
    }

    // 2. Nếu Cache Miss, mới gọi Service (tốn 5 external API calls)
    const fullHealth = await AdminService.getHealthStatus();

    // 3. Logic High Availability: Chỉ cần 1 trong 2 (Primary HOẶC Backup) sống là OK
    const publicStatus = {
      database: fullHealth.database.status === "HEALTHY",
      redis:
        fullHealth.redis.primary.status === "HEALTHY" ||
        fullHealth.redis.backup.status === "HEALTHY",
      cloudinary:
        fullHealth.cloudinary.primary.status === "HEALTHY" ||
        fullHealth.cloudinary.backup.status === "HEALTHY",
      ai:
        fullHealth.gemini.primaryKey.status === "HEALTHY" ||
        fullHealth.gemini.backupKey.status === "HEALTHY",
    };

    // 4. Lưu cache 30 giây
    await MultiLevelCache.set(cacheKey, publicStatus, 30);

    res.status(200).json({ success: true, data: publicStatus });
  });
  static unlockWallet = catchAsync(async (req: Request, res: Response) => {
    const { userId } = req.params;

    if (!userId || isNaN(Number(userId))) {
      return res
        .status(400)
        .json({ success: false, message: "User ID không hợp lệ!" });
    }

    const numericUserId = Number(userId);

    await prisma.$transaction(async (tx) => {
      await tx.wallets.update({
        where: { userId: numericUserId },
        data: { isLocked: false },
      });

      await tx.auditLog.create({
        data: {
          requestId: `MANUAL-UNLOCK-${Date.now()}`,
          userId: numericUserId,
          action: "ADMIN_UNLOCK_WALLET",
          resource: "Wallets",
          resourceId: String(numericUserId),
          oldData: { isLocked: true },
          newData: {
            isLocked: false,
            note: "Admin đã kiểm tra log và xác nhận mở khóa ví thủ công",
          },
          ipAddress: req.ip || "127.0.0.1",
        },
      });
    });

    return res.status(200).json({
      success: true,
      message: `Đã mở khóa ví thành công cho User #${numericUserId}!`,
    });
  });
  static getSystemAlerts = catchAsync(async (req: Request, res: Response) => {
    // Lấy cảnh báo vé lỗi (từ AI hoặc Cron)
    const ticketAlert = await prisma.auditLog.findFirst({
      where: { action: "AI_ANOMALY_ALERT" },
      orderBy: { createdAt: "desc" },
    });

    // Lấy cảnh báo ví bị khóa (từ AIOps)
    const financialAlert = await prisma.auditLog.findFirst({
      where: { action: "SYSTEM_AUTO_DEBIT_AND_FREEZE" },
      orderBy: { createdAt: "desc" },
    });

    // Đếm số ví đang bị khóa
    const lockedWalletsCount = await prisma.wallets.count({
      where: { isLocked: true },
    });

    res.status(200).json({
      success: true,
      data: {
        ticketAlert: ticketAlert?.newData || null,
        financialAlert: financialAlert?.newData || null,
        lockedWalletsCount,
      },
    });
  });
  // Lấy trạng thái bảo trì hiện tại
  static getMaintenanceStatus = catchAsync(
    async (req: Request, res: Response) => {
      const isMaintenance = await redisPrimary.get("system:maintenance_mode");

      res.status(200).json({
        success: true,
        data: { isMaintenance: isMaintenance === "true" },
      });
    },
  );

  // Bật / Tắt bảo trì
  static toggleMaintenance = catchAsync(async (req: Request, res: Response) => {
    const { enable } = req.body;

    if (enable) {
      await redisPrimary.set("system:maintenance_mode", "true");
      await redisPrimary.expire("system:maintenance_mode", 900);
      return res
        .status(200)
        .json({ success: true, message: "Đã BẬT bảo trì khẩn cấp!" });
    } else {
      await redisPrimary.del("system:maintenance_mode");
      return res.status(200).json({
        success: true,
        message: "Đã TẮT bảo trì. Hệ thống mở cửa trở lại!",
      });
    }
  });
}
