import prisma from "../database/prismaClient";
import { AIProxyService } from "./aiProxy.service";

export class TicketService {
  // 1. Lấy danh sách vé cho Admin (có tìm kiếm & phân trang)
  static async getAllTicketsForAdmin(
    page: number = 1,
    limit: number = 15,
    search?: string,
  ) {
    const skip = (page - 1) * limit;

    const whereCondition: any = {};
    if (search) {
      const searchNum = Number(search);
      whereCondition.OR = [
        { id: isNaN(searchNum) ? undefined : searchNum },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { trip: { route: { contains: search, mode: "insensitive" } } },
        { batchId: { contains: search, mode: "insensitive" } },
      ].filter((cond) => Object.values(cond)[0] !== undefined);
    }

    const [tickets, total] = await prisma.$transaction([
      prisma.tickets.findMany({
        where: whereCondition,
        include: {
          user: { select: { email: true, fullName: true } },
          trip: { select: { route: true, price: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.tickets.count({ where: whereCondition }),
    ]);

    // Đánh dấu các vé bất thường (giá thực trả < giá gốc hoặc = 0)
    const formattedTickets = tickets.map((t) => {
      const isAnomaly =
        t.status === "CONFIRMED" &&
        (Number(t.paidAmount || 0) < Number(t.trip.price) ||
          Number(t.paidAmount) === 0);
      return { ...t, isAnomaly };
    });

    return {
      data: formattedTickets,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // 2. Dùng AI quét bất thường (Tìm vé 0đ hoặc sai giá)
  static async scanAnomalies() {
    const anomalies = await prisma.$queryRaw`
      SELECT t.id, t."userId", t."tripId", t."paidAmount", tr.price AS "expectedPrice", tr.route
      FROM "Tickets" t
      JOIN "Trips" tr ON t."tripId" = tr.id
      WHERE t.status = 'CONFIRMED' 
        AND (t."paidAmount" IS NULL OR t."paidAmount" < tr.price OR t."paidAmount" = 0)
      ORDER BY t."createdAt" DESC
      LIMIT 20;
    `;

    if (!anomalies || (anomalies as any[]).length === 0) {
      return {
        anomalies: [],
        aiAnalysis: "Hệ thống không phát hiện bất thường nào.",
      };
    }

    try {
      const prompt = `Bạn là chuyên gia tài chính. Hãy phân tích danh sách các vé bị lỗi giá sau đây và dự đoán nguyên nhân (VD: Lỗi nhập giá 0đ, bug code, hay vé tặng?): ${JSON.stringify(anomalies)}. Trả lời ngắn gọn trong 1 đoạn văn.`;

      // SỬA LỖI: Dùng đúng tên hàm generateWithFallback
      const aiResponse = await AIProxyService.generateWithFallback(prompt);

      return { anomalies, aiAnalysis: aiResponse };
    } catch (error: any) {
      return {
        anomalies,
        aiAnalysis:
          "Không thể gọi AI phân tích lúc này, nhưng danh sách vé lỗi đã được tìm thấy.",
      };
    }
  }
}
