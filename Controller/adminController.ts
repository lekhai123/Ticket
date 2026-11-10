import type { Request, Response, NextFunction } from "express";
import { AdminService } from "../Service/adminService";
import prisma from "../database/prismaClient";
import { TicketService } from "../Service/ticketService";
import { BookingService } from "../Service/bookingService";

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

      // 1. Tự động tìm tất cả vé lỗi (giá 0đ hoặc nhỏ hơn giá gốc)
      const anomalies: any[] = await prisma.$queryRaw`
      SELECT t.id 
      FROM "Tickets" t
      JOIN "Trips" tr ON t."tripId" = tr.id
      WHERE t.status = 'CONFIRMED' 
        AND (t."paidAmount" IS NULL OR t."paidAmount" < tr.price OR t."paidAmount" = 0)
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

      // 2. Gọi hàm thu hồi hàng loạt (đã viết ở các bước trước)
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
    const fullHealth = await AdminService.getHealthStatus();

    const publicStatus = {
      database: fullHealth.database.status === "HEALTHY",
      redis: fullHealth.redis.primary.status === "HEALTHY",
      cloudinary: fullHealth.cloudinary.primary.status === "HEALTHY",
      ai: fullHealth.gemini.primaryKey.status === "HEALTHY",
    };

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
}
