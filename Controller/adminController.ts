import type { Request, Response, NextFunction } from "express";
import { AdminService } from "../Service/adminService";
import prisma from "../database/prismaClient";

// Wrapper hứng error async tự động chuyển sang Express Error Middleware, KHÔNG cần viết try...catch
const catchAsync =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };

export class AdminController {
  // Lấy thống kê tổng quan Admin
  static getStats = catchAsync(async (req: Request, res: Response) => {
    const stats = await AdminService.getSystemStats();
    res.status(200).json({
      success: true,
      data: stats,
    });
  });

  // Lấy danh sách người dùng
  static getUsers = catchAsync(async (req: Request, res: Response) => {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const search = req.query.search ? String(req.query.search) : undefined;

    const result = await AdminService.getAllUsers({
      page,
      limit,
      ...(search && { search }),
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  });

  // Tặng quà / Nạp tiền hàng loạt
  // FILE: Controller/adminController.ts

  static massGift = catchAsync(async (req: Request, res: Response) => {
    // 🎯 Lấy adminUserId uy tín từ req.user
    const user = (req as any).user;
    const adminUserId = user?.id || user?.userId;
    if (!adminUserId) {
      res.status(401).json({
        success: false,
        message: "Phiên làm việc hết hạn hoặc không tìm thấy thông tin Admin!",
      });
      return; // 👈 Tách return riêng ra để hàm trả về void
    }

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
  // Lấy danh sách Audit Logs
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

    res.status(200).json({
      success: true,
      data: result,
    });
  });

  // Kiểm tra sức khỏe hệ thống
  static getHealth = catchAsync(async (req: Request, res: Response) => {
    const healthData = await AdminService.getHealthStatus();
    const isHealthy = healthData.database.status === "HEALTHY";

    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      data: healthData,
    });
  });
}
export const unlockWallet = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // 1. Validation kiểm tra userId
    if (!userId || typeof userId !== "string") {
      return res.status(400).json({
        success: false,
        message: "ID người dùng không hợp lệ!",
      });
    }

    const numericUserId = Number(userId);
    if (isNaN(numericUserId)) {
      return res.status(400).json({
        success: false,
        message: "User ID phải là một số nguyên hợp lệ!",
      });
    }

    // 2. Thực hiện Mở khóa ví & Ghi AuditLog trong 1 Transaction
    await prisma.$transaction(async (tx) => {
      // Cập nhật trạng thái ví
      await tx.wallets.update({
        where: { userId: numericUserId },
        data: { isLocked: false },
      });

      // Ghi vết AuditLog (Dùng String(userId) hoặc String(numericUserId) để không bị lỗi Type)
      await tx.auditLog.create({
        data: {
          requestId: `MANUAL-UNLOCK-${Date.now()}`,
          userId: numericUserId,
          action: "ADMIN_UNLOCK_WALLET",
          resource: "Wallets",
          resourceId: String(numericUserId), // 👈 Đã ép kiểu sang string chuẩn 100%
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
  } catch (error: any) {
    console.error("Lỗi khi mở khóa ví:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Không thể mở khóa ví!",
    });
  }
};
