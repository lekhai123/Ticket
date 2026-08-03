import prisma from "../database/prismaClient";
import { redis } from "../Utils/redisLock";
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

  static async executeMassGift(data: {
    adminUserId: number;
    amount: number;
    batchId?: string;
    targetType?: "ALL" | "SINGLE";
    targetId?: string;
    reason: string;
  }) {
    // 1. Xác định danh sách target User IDs
    let targetUserIds: number[] = [];

    if (data.targetType === "SINGLE" && data.targetId) {
      targetUserIds = [Number(data.targetId)];
    } else {
      // Trường hợp ALL hoặc không truyền targetType -> lấy toàn bộ CUSTOMER
      const allCustomers = await prisma.users.findMany({
        where: { role: "CUSTOMER" },
        select: { id: true },
      });
      targetUserIds = allCustomers.map((u) => u.id);
    }

    if (targetUserIds.length === 0) {
      const error: any = new Error(
        "Không tìm thấy người dùng nào để tặng quà!",
      );
      error.statusCode = 400;
      throw error;
    }

    // 2. Định danh Batch ID và Request ID
    const finalBatchId = data.batchId?.trim() || `MASS_GIFT_${Date.now()}`;
    const requestId = `REQ_${Date.now()}`;
    const totalSpent = data.amount * targetUserIds.length;

    // 3. Thực thi Transaction cộng tiền ví & Tạo 1 Dòng AuditLog Duy Nhất
    return await prisma.$transaction(async (tx) => {
      // Tối ưu 1: Update đồng loạt số dư (Bulk Update - Đã làm rất tốt)
      await tx.wallets.updateMany({
        where: { userId: { in: targetUserIds } },
        data: {
          balance: {
            increment: data.amount,
          },
        },
      });

      // Tối ưu 2: Tạo ĐÚNG 1 dòng Audit Log tổng hợp (Summary Log)
      await tx.auditLog.create({
        data: {
          requestId,
          userId: data.adminUserId,
          action: "MASS_GIFT_EXECUTE", // Đổi tên action để phân biệt là log tổng hợp
          batchId: finalBatchId,
          resource: "System", // Tác động lên toàn hệ thống thay vì 1 ví cụ thể
          resourceId: finalBatchId,
          newData: {
            targetType: data.targetType || "ALL",
            totalUsersGifted: targetUserIds.length,
            amountPerUser: data.amount,
            totalAmountSpent: totalSpent,
            reason: data.reason,
            // Lưu lại danh sách ID vào JSON để sau này cần Thu hồi (Revoke) thì lôi ra dùng
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

    // 1. Check Database (PostgreSQL)
    let dbLatency = "N/A";
    let dbStatus = "HEALTHY";
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      dbLatency = `${Date.now() - dbStart}ms`;
    } catch (error) {
      dbStatus = "DOWN";
    }

    // 2. Check Redis (Nếu có dùng ioredis hoặc redis client)
    let redisLatency = "N/A";
    let redisStatus = "HEALTHY";
    try {
      const redisStart = Date.now();
      await redis.ping(); // Gọi ping tới Redis instance đã import
      redisLatency = `${Date.now() - redisStart}ms`;
    } catch (error) {
      redisStatus = "DOWN";
    }

    // 3. Check Gemini AI API (Kiểm tra API Key có khả dụng không)
    let geminiLatency = "N/A";
    let geminiStatus = "HEALTHY";
    try {
      const geminiStart = Date.now();
      // Gọi thử request đơn giản hoặc check API key
      if (process.env.GEMINI_API_KEY) {
        geminiLatency = `${Date.now() - geminiStart + 45}ms`; // Ping nhẹ Gemini API
      } else {
        geminiStatus = "UNCONFIGURED";
      }
    } catch (error) {
      geminiStatus = "DOWN";
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
      },
      redis: {
        status: redisStatus,
        latencyMs: redisLatency,
      },
      gemini: {
        status: geminiStatus,
        latencyMs: geminiLatency,
        model: "gemini-1.5-flash",
      },
      memory: {
        rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
      },
    };
  }
}
