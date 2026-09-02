import type { Request, Response, NextFunction } from "express";
import prisma from "../database/prismaClient";
import { redisPrimary, redisBackup } from "../Utils/redisLock";
import { cloudinaryPrimary, cloudinaryBackup } from "../config/cloudinary";
import { GoogleGenerativeAI } from "@google/generative-ai";
export class AdminService {
  /**
   * Lấy số liệu thống kê tổng quan hệ thống cho Admin Dashboard
   */
  static async getSystemStats() {
    // 1. Đếm tổng số lượng người dùng (Role CUSTOMER)
    const totalUsers = await prisma.users.count({
      where: { role: "CUSTOMER" },
    });

    // 2. Đếm tổng số chuyến xe
    const totalTrips = await prisma.trips.count();

    // 3. Đếm tổng số vé đã được xác nhận (CONFIRMED)
    const totalTicketsSold = await prisma.tickets.count({
      where: { status: "CONFIRMED" },
    });

    // 4. Lấy danh sách vé CONFIRMED kèm giá từ Trips để tính tổng doanh thu
    const confirmedTickets = await prisma.tickets.findMany({
      where: { status: "CONFIRMED" },
      select: {
        trip: {
          select: { price: true, route: true },
        },
      },
    });

    const totalRevenue = confirmedTickets.reduce((sum, ticket) => {
      return sum + Number(ticket.trip?.price || 0);
    }, 0);

    // 5. Tính tổng số tiền trong ví của toàn bộ người dùng
    const walletBalanceSum = await prisma.wallets.aggregate({
      _sum: { balance: true },
    });

    // 🌟 6. TÍNH TOP TUYẾN ĐƯỜNG (Thống kê số lượng vé theo tuyến)
    const routeMap: Record<string, number> = {};
    confirmedTickets.forEach((ticket) => {
      const routeName = ticket.trip?.route || "Không xác định";
      routeMap[routeName] = (routeMap[routeName] || 0) + 1;
    });

    const topRoutes = Object.entries(routeMap).map(([name, tickets]) => ({
      name,
      tickets,
    }));

    // 🌟 7. TẠO DỮ LIỆU MẪU CHO BIỂU ĐỒ DOANH THU 7 NGÀY (Hoặc query theo ngày tạo vé)
    const revenueChart = [
      { date: "T2", amount: totalRevenue * 0.1 },
      { date: "T3", amount: totalRevenue * 0.15 },
      { date: "T4", amount: totalRevenue * 0.2 },
      { date: "T5", amount: totalRevenue * 0.1 },
      { date: "T6", amount: totalRevenue * 0.25 },
      { date: "T7", amount: totalRevenue * 0.15 },
      { date: "CN", amount: totalRevenue * 0.05 },
    ];

    return {
      totalRevenue,
      totalUsers,
      totalTrips,
      totalTicketsSold,
      totalSystemWalletBalance: Number(walletBalanceSum._sum.balance || 0),
      topRoutes,
      revenueChart,
    };
  }
  static async getAllUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const whereCondition = params.search
      ? {
          OR: [
            {
              fullName: {
                contains: params.search,
                mode: "insensitive" as const,
              },
            },
            {
              email: { contains: params.search, mode: "insensitive" as const },
            },
          ],
        }
      : {};

    const [users, total] = await prisma.$transaction([
      prisma.users.findMany({
        where: whereCondition,
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          createdAt: true,
          wallet: {
            select: {
              balance: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.users.count({ where: whereCondition }),
    ]);

    return {
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
  // FILE: Service/adminService.ts

  // FILE: Service/adminService.ts

  static async executeMassGift(data: {
    adminUserId: number;
    amount: number;
    batchId?: string;
    targetType?: "ALL" | "SINGLE";
    targetId?: string;
    reason: string;
  }) {
    // 1. Xác định danh sách target Users (Không ép type number thủ công cho balance để Prisma tự infer)
    let targetUsers: {
      id: number;
      wallet: { id: number; balance: any } | null;
    }[] = [];

    if (data.targetType === "SINGLE" && data.targetId) {
      const singleUser = await prisma.users.findUnique({
        where: { id: Number(data.targetId) },
        select: { id: true, wallet: { select: { id: true, balance: true } } },
      });
      if (singleUser) targetUsers = [singleUser];
    } else {
      targetUsers = await prisma.users.findMany({
        where: { role: "CUSTOMER" },
        select: { id: true, wallet: { select: { id: true, balance: true } } },
      });
    }

    // Lọc các User có Ví hợp lệ
    const validUsers = targetUsers.filter((u) => u.wallet !== null);
    const targetUserIds = validUsers.map((u) => u.id);

    if (targetUserIds.length === 0) {
      const error: any = new Error(
        "Không tìm thấy người dùng hợp lệ để tặng quà!",
      );
      error.statusCode = 400;
      throw error;
    }

    // 2. Định danh Batch ID và Request ID
    const finalBatchId = data.batchId?.trim() || `MASS_GIFT_${Date.now()}`;
    const requestId = `REQ_${Date.now()}`;
    const totalSpent = data.amount * targetUserIds.length;

    // 3. Thực thi Transaction
    return await prisma.$transaction(async (tx) => {
      // Bulk Update số dư
      await tx.wallets.updateMany({
        where: { userId: { in: targetUserIds } },
        data: {
          balance: {
            increment: data.amount,
          },
        },
      });

      // 🟢 Chuyển Decimal sang number bằng Number(...) để hết lỗi TS2322
      const userAuditLogs = validUsers.map((u) => {
        const oldBalance = Number(u.wallet!.balance); // 🎯 Convert Decimal -> number ở đây!
        const newBalance = oldBalance + data.amount;

        return {
          requestId,
          userId: u.id,
          action: "MASS_GIFT_RECEIVED",
          batchId: finalBatchId,
          resource: "Wallets",
          resourceId: String(u.wallet!.id),
          oldData: { balance: oldBalance },
          newData: {
            amount: data.amount,
            giftAmount: data.amount,
            description: `Nhận quà tặng từ Admin: +${data.amount.toLocaleString("vi-VN")} VNĐ (Lý do: ${data.reason})`,
            newBalance: newBalance,
            reason: data.reason,
          },
          ipAddress: null,
          isRevoked: false,
        };
      });

      // Bulk Insert AuditLogs
      await tx.auditLog.createMany({
        data: userAuditLogs,
      });

      // AuditLog tổng hợp cho Admin
      await tx.auditLog.create({
        data: {
          requestId,
          userId: data.adminUserId,
          action: "MASS_GIFT_EXECUTE",
          batchId: finalBatchId,
          resource: "System",
          resourceId: finalBatchId,
          newData: {
            targetType: data.targetType || "ALL",
            totalUsersGifted: targetUserIds.length,
            amountPerUser: data.amount,
            totalAmountSpent: totalSpent,
            reason: data.reason,
            affectedUserIds: targetUserIds,
          },
          isRevoked: false,
        },
      });

      return {
        batchId: finalBatchId,
        totalUsersGifted: targetUserIds.length,
        amountPerUser: data.amount,
        totalAmountSpent: totalSpent,
      };
    });
  }
  static async getAuditLogs(params: {
    page?: number;
    limit?: number;
    batchId?: string;
    action?: string;
    userId?: number;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 15;
    const skip = (page - 1) * limit;

    const whereCondition: any = {};

    if (params.batchId) {
      whereCondition.batchId = params.batchId;
    }
    if (params.action) {
      whereCondition.action = params.action;
    }
    if (params.userId) {
      whereCondition.userId = params.userId;
    }

    // 🎯 BỔ SUNG: Nếu Admin đang xem trang AuditLog tổng quan (Không filter theo userId hay action cụ thể)
    // Lọc bỏ bớt các log cá nhân nhỏ lẻ để màn hình Admin sạch đẹp!
    if (!params.userId && !params.action) {
      whereCondition.action = {
        notIn: ["MASS_GIFT_RECEIVED", "MASS_GIFT_REVOKED"],
      };
    }

    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where: whereCondition,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.auditLog.count({ where: whereCondition }),
    ]);

    return {
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
  // Trong AdminService.ts
  static async getHealthStatus() {
    const startTime = Date.now();

    // 1. Check PostgreSQL Database
    let dbLatency = "N/A";
    let dbStatus = "HEALTHY";
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      dbLatency = `${Date.now() - dbStart}ms`;
    } catch (error) {
      dbStatus = "DOWN";
    }

    // 2. Check Redis Primary & Redis Backup
    let redisPrimaryLatency = "N/A";
    let redisPrimaryStatus = "HEALTHY";
    try {
      const start = Date.now();
      await redisPrimary.ping();
      redisPrimaryLatency = `${Date.now() - start}ms`;
    } catch (error) {
      redisPrimaryStatus = "DOWN";
    }

    let redisBackupLatency = "N/A";
    let redisBackupStatus = "HEALTHY";
    if (redisBackup) {
      try {
        const start = Date.now();
        await redisBackup.ping();
        redisBackupLatency = `${Date.now() - start}ms`;
      } catch (error) {
        redisBackupStatus = "DOWN";
      }
    } else {
      redisBackupStatus = "UNCONFIGURED";
    }

    // 3. Check Cloudinary Primary & Cloudinary Backup
    let cloudPrimaryStatus = "HEALTHY";
    let cloudPrimaryLatency = "N/A";
    try {
      const start = Date.now();
      await cloudinaryPrimary.api.ping();
      cloudPrimaryLatency = `${Date.now() - start}ms`;
    } catch (error) {
      cloudPrimaryStatus = "DOWN";
    }

    let cloudBackupStatus = "HEALTHY";
    let cloudBackupLatency = "N/A";
    try {
      const start = Date.now();
      await cloudinaryBackup.api.ping();
      cloudBackupLatency = `${Date.now() - start}ms`;
    } catch (error) {
      cloudBackupStatus = "DOWN";
    }

    // 4. Check Gemini AI Multi-Key API
    let geminiPrimaryStatus = "HEALTHY";
    let geminiPrimaryLatency = "N/A";
    const primaryKey = process.env.GEMINI_API_KEY;

    if (primaryKey) {
      try {
        const start = Date.now();
        const genAI = new GoogleGenerativeAI(primaryKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        await model.countTokens("ping"); // Request đếm token siêu nhẹ để test ping
        geminiPrimaryLatency = `${Date.now() - start}ms`;
      } catch (error) {
        geminiPrimaryStatus = "DOWN";
      }
    } else {
      geminiPrimaryStatus = "UNCONFIGURED";
    }

    let geminiBackupStatus = "HEALTHY";
    let geminiBackupLatency = "N/A";
    const backupKey = process.env.GEMINI_SECONDARY_KEY;

    if (backupKey) {
      try {
        const start = Date.now();
        const genAI = new GoogleGenerativeAI(backupKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        await model.countTokens("ping");
        geminiBackupLatency = `${Date.now() - start}ms`;
      } catch (error) {
        geminiBackupStatus = "DOWN";
      }
    } else {
      geminiBackupStatus = "UNCONFIGURED";
    }

    return {
      server: {
        status: "UP",
        uptimeSeconds: Math.floor(process.uptime()),
        nodeVersion: process.version,
        timestamp: new Date().toISOString(),
      },
      database: {
        status: dbStatus,
        latencyMs: dbLatency,
        provider: "PostgreSQL (Supabase)",
      },
      redis: {
        primary: {
          status: redisPrimaryStatus,
          latencyMs: redisPrimaryLatency,
          name: "Upstash Redis Primary",
        },
        backup: {
          status: redisBackupStatus,
          latencyMs: redisBackupLatency,
          name: "Upstash Redis Backup",
        },
        activeProvider:
          redisPrimaryStatus === "HEALTHY" ? "PRIMARY" : "BACKUP (Failover)",
      },
      cloudinary: {
        primary: {
          status: cloudPrimaryStatus,
          latencyMs: cloudPrimaryLatency,
          name: "Cloudinary Primary",
        },
        backup: {
          status: cloudBackupStatus,
          latencyMs: cloudBackupLatency,
          name: "Cloudinary Backup",
        },
        activeProvider:
          cloudPrimaryStatus === "HEALTHY" ? "PRIMARY" : "BACKUP (Failover)",
      },
      gemini: {
        primaryKey: {
          status: geminiPrimaryStatus,
          latencyMs: geminiPrimaryLatency,
        },
        backupKey: {
          status: geminiBackupStatus,
          latencyMs: geminiBackupLatency,
        },
        model: "gemini-2.5-flash",
        activeKey:
          geminiPrimaryStatus === "HEALTHY" ? "PRIMARY_KEY" : "BACKUP_KEY",
      },
      memory: {
        rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
      },
    };
  }
}
