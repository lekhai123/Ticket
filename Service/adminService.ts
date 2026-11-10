import type { Request, Response, NextFunction } from "express";
import prisma from "../database/prismaClient";
import { redisPrimary, redisBackup } from "../Utils/redisLock";
import { v2 as cloudinary } from "cloudinary";
import {
  cloudinaryPrimaryConfig,
  cloudinaryBackupConfig,
} from "../config/cloudinary";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { MultiLevelCache } from "./cacheService";
import { sendNotificationEmail } from "../queues/mailQueue";

export class AdminService {
  static async getSystemStats() {
    const totalUsers = await prisma.users.count({
      where: { role: "CUSTOMER" },
    });
    const totalTrips = await prisma.trips.count();
    const totalTicketsSold = await prisma.tickets.count({
      where: { status: "CONFIRMED" },
    });
    const walletBalanceSum = await prisma.wallets.aggregate({
      _sum: { balance: true },
    });

    const totalRevResult: any[] = await prisma.$queryRaw`
      SELECT SUM(total_revenue) as total FROM revenue_stats
    `;
    const totalRevenue = Number(totalRevResult[0]?.total || 0);

    const topRoutes: any[] = await prisma.$queryRaw`
      SELECT tr.route as name, COUNT(t.id) as tickets
      FROM "Tickets" t
      JOIN "Trips" tr ON t."tripId" = tr.id
      WHERE t.status = 'CONFIRMED'
      GROUP BY tr.route
      ORDER BY tickets DESC
      LIMIT 5
    `;
    const formattedTopRoutes = topRoutes.map((r) => ({
      name: r.name,
      tickets: Number(r.tickets),
    }));

    const chartData: any[] = await prisma.$queryRaw`
      SELECT 
        TO_CHAR(date, 'DD/MM') as date,
        total_revenue as amount
      FROM revenue_stats
      WHERE date >= CURRENT_DATE - INTERVAL '7 days'
    `;

    const revenueChartMap = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
      });
      revenueChartMap.set(dateStr, 0);
    }

    chartData.forEach((row) => {
      if (revenueChartMap.has(row.date)) {
        revenueChartMap.set(row.date, Number(row.amount));
      }
    });

    const revenueChart = Array.from(revenueChartMap.entries()).map(
      ([date, amount]) => ({
        date,
        amount,
      }),
    );

    return {
      totalRevenue,
      totalUsers,
      totalTrips,
      totalTicketsSold,
      totalSystemWalletBalance: Number(walletBalanceSum._sum.balance || 0),
      topRoutes: formattedTopRoutes,
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
              isLocked: true,
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
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  static async executeMassGift(data: {
    adminUserId: number;
    amount: number;
    batchId?: string;
    targetType?: "ALL" | "SINGLE";
    targetId?: string;
    reason: string;
  }) {
    let targetUsers: {
      id: number;
      email: string;
      fullName: string;
      wallet: { id: number; balance: any } | null;
    }[] = [];

    if (data.targetType === "SINGLE" && data.targetId) {
      const singleUser = await prisma.users.findUnique({
        where: { id: Number(data.targetId) },
        select: {
          id: true,
          email: true,
          fullName: true,
          wallet: { select: { id: true, balance: true } },
        },
      });
      if (singleUser) targetUsers = [singleUser];
    } else {
      targetUsers = await prisma.users.findMany({
        where: { role: "CUSTOMER" },
        select: {
          id: true,
          email: true,
          fullName: true,
          wallet: { select: { id: true, balance: true } },
        },
      });
    }

    const validUsers = targetUsers.filter((u) => u.wallet !== null);
    const targetUserIds = validUsers.map((u) => u.id);

    if (targetUserIds.length === 0) {
      const error: any = new Error(
        "Không tìm thấy người dùng hợp lệ để tặng quà!",
      );
      error.statusCode = 400;
      throw error;
    }

    const finalBatchId = data.batchId?.trim() || `MASS_GIFT_${Date.now()}`;
    const requestId = `REQ_${Date.now()}`;
    const totalSpent = data.amount * targetUserIds.length;

    const result = await prisma.$transaction(async (tx) => {
      await tx.wallets.updateMany({
        where: { userId: { in: targetUserIds } },
        data: { balance: { increment: data.amount } },
      });

      const userAuditLogs = validUsers.map((u) => {
        const oldBalance = Number(u.wallet!.balance);
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

      const CHUNK_SIZE = 1000;
      for (let i = 0; i < userAuditLogs.length; i += CHUNK_SIZE) {
        const chunk = userAuditLogs.slice(i, i + CHUNK_SIZE);
        await tx.auditLog.createMany({ data: chunk });
      }

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
            performedByAdminId: data.adminUserId,
            targetUserName:
              validUsers.length === 1 ? validUsers[0].fullName : null,
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

    validUsers.forEach((u) => {
      if (u.email) {
        sendNotificationEmail({
          email: u.email,
          type: "ADMIN_GIFT",
          data: {
            amount: data.amount,
            reason: data.reason,
          },
        }).catch((err) => {
          console.error(
            `[ADMIN] Lỗi đẩy job gửi mail quà tặng cho ${u.email}:`,
            err?.message,
          );
        });
      }
    });

    return result;
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

    if (params.batchId) whereCondition.batchId = params.batchId;
    if (params.action) whereCondition.action = params.action;
    if (params.userId) whereCondition.userId = params.userId;

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
        include: {
          user: {
            select: { fullName: true, email: true },
          },
        },
      }),
      prisma.auditLog.count({ where: whereCondition }),
    ]);

    return {
      logs,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  static async getHealthStatus() {
    let dbLatency = "N/A";
    let dbStatus = "HEALTHY";
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      dbLatency = `${Date.now() - dbStart}ms`;
    } catch (error) {
      dbStatus = "DOWN";
    }

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

    let cloudPrimaryStatus = "HEALTHY";
    let cloudPrimaryLatency = "N/A";
    try {
      const start = Date.now();
      await cloudinary.api.ping(cloudinaryPrimaryConfig);
      cloudPrimaryLatency = `${Date.now() - start}ms`;
    } catch (error) {
      cloudPrimaryStatus = "DOWN";
    }

    let cloudBackupStatus = "HEALTHY";
    let cloudBackupLatency = "N/A";
    try {
      const start = Date.now();
      await cloudinary.api.ping(cloudinaryBackupConfig);
      cloudBackupLatency = `${Date.now() - start}ms`;
    } catch (error) {
      cloudBackupStatus = "DOWN";
    }

    let geminiHealth = await MultiLevelCache.get<any>("admin:gemini_health");

    if (!geminiHealth) {
      geminiHealth = {
        primary: { status: "HEALTHY", latency: "N/A" },
        backup: { status: "HEALTHY", latency: "N/A" },
      };

      const primaryKey = process.env.GEMINI_API_KEY;
      if (primaryKey) {
        try {
          const start = Date.now();
          const genAI = new GoogleGenerativeAI(primaryKey);
          // ✅ ĐÃ ĐỔI SANG MODEL 3.8-FLASH
          const model = genAI.getGenerativeModel({ model: "gemini-3.8-flash" });
          await model.countTokens("ping");
          geminiHealth.primary.latency = `${Date.now() - start}ms`;
        } catch (error: any) {
          geminiHealth.primary.status = "DOWN";
          console.error("[HEALTH CHECK] Primary Key lỗi:", error.message);
        }
      } else {
        geminiHealth.primary.status = "UNCONFIGURED";
      }

      const backupKey = process.env.GEMINI_SECONDARY_KEY;
      if (backupKey) {
        try {
          const start = Date.now();
          const genAI = new GoogleGenerativeAI(backupKey);
          // ✅ ĐÃ ĐỔI SANG MODEL 3.8-FLASH
          const model = genAI.getGenerativeModel({ model: "gemini-3.8-flash" });
          await model.countTokens("ping");
          geminiHealth.backup.latency = `${Date.now() - start}ms`;
        } catch (error: any) {
          geminiHealth.backup.status = "DOWN";
          console.error("[HEALTH CHECK] Backup Key lỗi:", error.message);
        }
      } else {
        geminiHealth.backup.status = "UNCONFIGURED";
      }

      await MultiLevelCache.set("admin:gemini_health", geminiHealth, 300);
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
          status: geminiHealth.primary.status,
          latencyMs: geminiHealth.primary.latency,
        },
        backupKey: {
          status: geminiHealth.backup.status,
          latencyMs: geminiHealth.backup.latency,
        },
        model: "gemini-3.8-flash", // ✅ ĐÃ ĐỔI TÊN HIỂN THỊ
        activeKey:
          geminiHealth.primary.status === "HEALTHY"
            ? "PRIMARY_KEY"
            : "BACKUP_KEY",
      },
      memory: {
        rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
      },
    };
  }
}
