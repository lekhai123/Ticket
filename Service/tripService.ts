import prisma from "../database/prismaClient";
import { MultiLevelCache } from "./cacheService";
import { AIProxyService } from "./aiProxy.service";

// Gom toàn bộ cache key vào 1 chỗ để tránh lệch pattern
const CACHE_KEYS = {
  ALL_TRIPS: "trips:all:active",
  TRIP_DETAIL: (id: number) => `trips:detail:${id}`,
} as const;

export class TripService {
  static async getEmbedding(text: string): Promise<number[]> {
    return await AIProxyService.getEmbeddingWithFallback(text);
  }

  /**
   * Xóa cache liên quan 1 trip (hoặc toàn bộ nếu không truyền id).
   * Booking/hủy vé gọi hàm này để availableSeats và bookedSeatNumbers luôn tươi.
   */
  static async invalidateTripCaches(tripId?: number): Promise<void> {
    try {
      await MultiLevelCache.invalidate(CACHE_KEYS.ALL_TRIPS);
      if (tripId !== undefined) {
        await MultiLevelCache.invalidate(CACHE_KEYS.TRIP_DETAIL(tripId));
      }
    } catch (cacheErr: any) {
      console.warn("[TRIP] Xóa cache thất bại:", cacheErr.message);
    }
  }

  /**
   * Chuẩn hóa dữ liệu chuyến xe kèm số ghế thực tế.
   */
  private static formatTripWithSeats(trip: any) {
    const activeTickets = trip.tickets || [];
    const bookedSeatNumbers = activeTickets.map((t: any) => t.seatNumber);
    const totalSeats = trip.totalSeats ?? 30;
    const availableSeats = Math.max(0, totalSeats - bookedSeatNumbers.length);

    return {
      ...trip,
      totalSeats,
      availableSeats,
      bookedSeatNumbers,
    };
  }

  /**
   * Tạo chuyến xe mới kèm embedding cho semantic search.
   */
  static async createTripLogic(
    route: string,
    description: string | undefined,
    departureAt: string,
    price: number,
    totalSeats?: number,
  ) {
    const trimmedRoute = route.trim();
    const trimmedDesc = description ? description.trim() : "";
    const finalSeats = totalSeats && totalSeats > 0 ? totalSeats : 30;
    const textToEmbed = `Chuyến xe tuyến ${trimmedRoute}. Chi tiết mô tả: ${trimmedDesc}`;
    const vector = await this.getEmbedding(textToEmbed);
    const vectorString = `[${vector.join(",")}]`;

    // Insert raw để ghi được cột embedding (pgvector, Prisma không hỗ trợ native)
    // RETURNING id để biết chính xác trip vừa tạo, tránh findFirst nhầm
    const inserted: Array<{ id: number }> = await prisma.$queryRawUnsafe(
      `INSERT INTO "Trips" (route, description, "departureAt", price, "totalSeats", embedding) 
       VALUES ($1, $2, $3, $4, $5, $6::vector) 
       RETURNING id`,
      trimmedRoute,
      trimmedDesc || null,
      new Date(departureAt),
      price,
      finalSeats,
      vectorString,
    );

    const createdTrip = await prisma.trips.findUnique({
      where: { id: inserted[0].id },
    });

    await this.invalidateTripCaches();
    return createdTrip;
  }

  /**
   * Lấy toàn bộ chuyến xe còn hiệu lực, cache 60s.
   */
  static async getAllTripsLogic(page: number = 1, limit: number = 12) {
    const cacheKey = `trips:all:active:page:${page}:limit:${limit}`;

    const cached = await MultiLevelCache.get(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const skip = (page - 1) * limit;

    const trips = await prisma.trips.findMany({
      where: { departureAt: { gt: now } },
      orderBy: { departureAt: "asc" },
      skip: skip,
      take: limit, // Lấy tối đa 12 chuyến 1 lần
      include: {
        tickets: {
          where: { status: { in: ["HELD", "PENDING", "CONFIRMED"] } },
          select: { seatNumber: true },
        },
      },
    });

    const formatted = trips.map((trip) => this.formatTripWithSeats(trip));
    await MultiLevelCache.set(cacheKey, formatted, 60);

    return formatted;
  }

  /**
   * Lấy chi tiết chuyến xe, cache 10s (ngắn để sơ đồ ghế không stale lâu).
   */
  static async getTripByIdLogic(id: number) {
    const cacheKey = CACHE_KEYS.TRIP_DETAIL(id);
    const cachedTrip = await MultiLevelCache.get(cacheKey);
    if (cachedTrip) return cachedTrip;

    const trip = await prisma.trips.findUnique({
      where: { id: Number(id) },
      include: {
        tickets: {
          where: { status: { in: ["HELD", "PENDING", "CONFIRMED"] } },
          select: { seatNumber: true, status: true },
        },
      },
    });

    if (!trip) return null;

    const formatted = this.formatTripWithSeats(trip);
    await MultiLevelCache.set(cacheKey, formatted, 10);
    return formatted;
  }

  /**
   * Cập nhật thông tin chuyến xe (Có kiểm tra ràng buộc thời gian và số ghế)
   */
  static async updateTripLogic(
    id: number,
    data: {
      route?: string;
      description?: string | null;
      departureAt?: string;
      price?: number;
      totalSeats?: number;
    },
  ) {
    const currentTrip = await prisma.trips.findUnique({ where: { id } });
    if (!currentTrip) throw new Error("Không tìm thấy chuyến xe cần cập nhật!");

    // 1. Không cho phép sửa chuyến xe đã khởi hành
    if (new Date(currentTrip.departureAt) < new Date()) {
      throw new Error("Không thể cập nhật chuyến xe đã khởi hành!");
    }

    // 2. Nếu có truyền ngày khởi hành mới, không được phép ở quá khứ
    if (data.departureAt) {
      const newDeparture = new Date(data.departureAt);
      if (newDeparture < new Date()) {
        throw new Error("Ngày khởi hành mới không được ở trong quá khứ!");
      }
    }

    // 3. Nếu Admin giảm số lượng ghế, phải đảm bảo không cắt giảm ghế khách đã đặt
    if (data.totalSeats !== undefined) {
      const bookedCount = await prisma.tickets.count({
        where: {
          tripId: id,
          status: { in: ["HELD", "PENDING", "CONFIRMED"] }, // Các ghế đang có người giữ
        },
      });

      if (data.totalSeats < bookedCount) {
        throw new Error(
          `Không thể giảm tổng số ghế xuống ${data.totalSeats} vì đã có ${bookedCount} ghế được khách đặt!`,
        );
      }
    }

    // Tiến hành cập nhật DB
    const finalRoute = data.route ? data.route.trim() : currentTrip.route;
    const finalDesc =
      data.description !== undefined
        ? data.description
          ? data.description.trim()
          : ""
        : (currentTrip as any).description || "";

    const updatedTrip = await prisma.trips.update({
      where: { id },
      data: {
        ...(data.route && { route: data.route.trim() }),
        ...(data.description !== undefined && {
          description: data.description ? data.description.trim() : null,
        }),
        ...(data.departureAt && { departureAt: new Date(data.departureAt) }),
        ...(data.price !== undefined && { price: Number(data.price) }),
        ...(data.totalSeats !== undefined && {
          totalSeats: Number(data.totalSeats),
        }),
      },
    });

    // Cập nhật Vector AI nếu thay đổi tuyến đường
    if (data.route || data.description !== undefined) {
      const textToEmbed = `Chuyến xe tuyến ${finalRoute}. Chi tiết mô tả: ${finalDesc}`;
      const vector = await this.getEmbedding(textToEmbed);
      const vectorString = `[${vector.join(",")}]`;

      await prisma.$executeRawUnsafe(
        `UPDATE "Trips" SET embedding = $1::vector WHERE id = $2`,
        vectorString,
        id,
      );
    }

    await this.invalidateTripCaches(id);
    return updatedTrip;
  }

  /**
   * Xóa chuyến xe (Chặn xóa chuyến đã chạy)
   */
  static async deleteTripLogic(id: number) {
    const currentTrip = await prisma.trips.findUnique({ where: { id } });
    if (!currentTrip) throw new Error("Không tìm thấy chuyến xe cần xóa!");

    // 1. Không cho phép xóa chuyến xe đã khởi hành (bảo toàn dữ liệu lịch sử)
    if (new Date(currentTrip.departureAt) < new Date()) {
      throw new Error(
        "Không thể xóa chuyến xe đã khởi hành để bảo toàn lịch sử!",
      );
    }

    // 2. Chặn xóa nếu đã có vé thanh toán thành công
    const hasPaidTickets = await prisma.tickets.findFirst({
      where: { tripId: id, status: "CONFIRMED" },
    });
    if (hasPaidTickets) {
      throw new Error(
        "Không thể xoá chuyến xe đã có vé thanh toán thành công!",
      );
    }

    // 3. Xóa các vé HELD/PENDING (nếu có) trước khi xóa chuyến
    await prisma.tickets.deleteMany({ where: { tripId: id } });

    const deletedTrip = await prisma.trips.delete({ where: { id } });

    await this.invalidateTripCaches(id);
    return deletedTrip;
  }
  static async getAllTripsForAdminLogic(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const [trips, total] = await prisma.$transaction([
      prisma.trips.findMany({
        orderBy: { departureAt: "desc" },
        skip: skip,
        take: limit,
        include: {
          tickets: {
            where: { status: { in: ["HELD", "PENDING", "CONFIRMED"] } },
            select: { seatNumber: true },
          },
        },
      }),
      prisma.trips.count(),
    ]);

    return {
      data: trips.map((trip) => this.formatTripWithSeats(trip)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
  /**
   * Tìm chuyến bằng từ khóa (ILIKE) hoặc semantic search (pgvector).
   */
  static async searchTripsSemanticLogic(prompt: string = "", limit = 10) {
    const safePrompt = typeof prompt === "string" ? prompt : "";
    const cleanPrompt = safePrompt.trim().toLowerCase();

    if (
      !cleanPrompt ||
      cleanPrompt.includes("tất cả") ||
      cleanPrompt.includes("danh sách")
    ) {
      return await this.getAllTripsLogic();
    }

    const now = new Date();

    // 1. Xử lý từ khóa thời gian (Mở rộng thêm "đêm", "tối nay", v.v.)
    let timeConditionPrisma: any = { departureAt: { gt: now } };
    let timeConditionSQL = "";
    let hasTimeFilter = false;

    if (
      cleanPrompt.includes("tối") ||
      cleanPrompt.includes("đêm") ||
      cleanPrompt.includes("khuya")
    ) {
      const startEvening = new Date(now);
      startEvening.setHours(18, 0, 0, 0);
      const endEvening = new Date(now);
      endEvening.setHours(23, 59, 59, 999);
      const searchStart = now > startEvening ? now : startEvening;

      timeConditionPrisma = {
        departureAt: { gte: searchStart, lte: endEvening },
      };
      timeConditionSQL = `AND EXTRACT(HOUR FROM "departureAt") >= 18`;
      hasTimeFilter = true;
    } else if (cleanPrompt.includes("sáng")) {
      const startMorning = new Date(now);
      startMorning.setHours(0, 0, 0, 0);
      const endMorning = new Date(now);
      endMorning.setHours(11, 59, 59, 999);
      const searchStart =
        now > endMorning
          ? new Date(now.setDate(now.getDate() + 1))
          : now > startMorning
            ? now
            : startMorning;
      searchStart.setHours(0, 0, 0, 0);

      timeConditionPrisma = { departureAt: { gt: searchStart } };
      timeConditionSQL = `AND EXTRACT(HOUR FROM "departureAt") < 12`;
      hasTimeFilter = true;
    } else if (cleanPrompt.includes("chiều")) {
      const startAfternoon = new Date(now);
      startAfternoon.setHours(12, 0, 0, 0);
      const endAfternoon = new Date(now);
      endAfternoon.setHours(17, 59, 59, 999);
      const searchStart = now > startAfternoon ? now : startAfternoon;

      timeConditionPrisma = {
        departureAt: { gte: searchStart, lte: endAfternoon },
      };
      timeConditionSQL = `AND EXTRACT(HOUR FROM "departureAt") >= 12 AND EXTRACT(HOUR FROM "departureAt") < 18`;
      hasTimeFilter = true;
    }

    // 2. Lọc bỏ các từ nhiễu (CHỈ dùng cho SQL ILIKE, giữ nguyên câu cho AI)
    const stopWords = [
      "tôi",
      "mình",
      "muốn",
      "cần",
      "tìm",
      "xe",
      "đi",
      "vé",
      "chuyến",
      "có",
      "không",
      "và",
      "thì",
      "là",
      "ở",
      "từ",
      "đến",
      "về",
      "những",
      "các",
      "một",
      "cho",
    ];
    const searchTerms = cleanPrompt
      .split(/\s+/)
      .filter((w) => !stopWords.includes(w));
    const keywordSearch = searchTerms.length > 0 ? searchTerms.join(" ") : "";

    const resultMap = new Map<number, any>();

    // 3. TÌM KIẾM TEXT (Lần 1: Có bộ lọc thời gian)
    if (searchTerms.length > 0) {
      const whereCondition: any = { ...timeConditionPrisma };
      whereCondition.AND = searchTerms.map((term) => ({
        OR: [
          { route: { contains: term, mode: "insensitive" } },
          { description: { contains: term, mode: "insensitive" } },
        ],
      }));

      const keywordTrips = await prisma.trips.findMany({
        where: whereCondition,
        take: limit,
        orderBy: { departureAt: "asc" },
        include: {
          tickets: {
            where: { status: { in: ["HELD", "PENDING", "CONFIRMED"] } },
            select: { seatNumber: true },
          },
        },
      });

      keywordTrips.forEach((trip) =>
        resultMap.set(trip.id, this.formatTripWithSeats(trip)),
      );
    }

    // 4. NẾU ÁP DỤNG THỜI GIAN MÀ KHÔNG CÓ KẾT QUẢ -> TỰ ĐỘNG BỎ LỌC THỜI GIAN (Fallback)
    if (hasTimeFilter && resultMap.size === 0 && searchTerms.length > 0) {
      console.log(
        "[SEARCH] Không có chuyến đúng giờ, tự động mở rộng tìm kiếm bỏ qua thời gian.",
      );
      const whereCondition: any = { departureAt: { gt: now } };
      whereCondition.AND = searchTerms.map((term) => ({
        OR: [
          { route: { contains: term, mode: "insensitive" } },
          { description: { contains: term, mode: "insensitive" } },
        ],
      }));

      const fallbackTrips = await prisma.trips.findMany({
        where: whereCondition,
        take: limit,
        orderBy: { departureAt: "asc" },
        include: {
          tickets: {
            where: { status: { in: ["HELD", "PENDING", "CONFIRMED"] } },
            select: { seatNumber: true },
          },
        },
      });
      fallbackTrips.forEach((trip) =>
        resultMap.set(trip.id, this.formatTripWithSeats(trip)),
      );
    }

    // 5. SEMANTIC SEARCH (AI) - Chạy nếu chưa đủ số lượng
    if (keywordSearch && resultMap.size < limit) {
      try {
        // QUAN TRỌNG: Đưa NGUYÊN CÂU GỐC (cleanPrompt) vào AI để nó hiểu ngữ cảnh
        // Ví dụ: "tìm xe đi đà lạt buổi tối" -> AI sẽ tự map "buổi tối" với các chuyến 18h+
        const queryVector = await this.getEmbedding(cleanPrompt);
        const vectorString = `[${queryVector.join(",")}]`;

        const SIMILARITY_THRESHOLD = 0.7;

        let semanticTrips: any[] = await prisma.$queryRawUnsafe(
          `
          SELECT id, route, "departureAt", price, "totalSeats", description,
                 1 - (embedding <=> $1::vector) AS similarity
          FROM "Trips"
          WHERE "departureAt" > NOW()
            ${timeConditionSQL}
            AND 1 - (embedding <=> $1::vector) > $2
          ORDER BY similarity DESC
          LIMIT $3
        `,
          vectorString,
          SIMILARITY_THRESHOLD,
          limit,
        );

        // Nếu AI có thời gian mà vẫn rỗng, thử AI không có thời gian
        if (semanticTrips.length === 0 && hasTimeFilter) {
          semanticTrips = await prisma.$queryRawUnsafe(
            `
            SELECT id, route, "departureAt", price, "totalSeats", description,
                   1 - (embedding <=> $1::vector) AS similarity
            FROM "Trips"
            WHERE "departureAt" > NOW()
              AND 1 - (embedding <=> $1::vector) > $2
            ORDER BY similarity DESC
            LIMIT $3
          `,
            vectorString,
            SIMILARITY_THRESHOLD,
            limit,
          );
        }

        // Gộp kết quả AI vào Map
        if (semanticTrips.length > 0) {
          const tripIds = semanticTrips.map((t) => t.id);
          const activeTickets = await prisma.tickets.findMany({
            where: {
              tripId: { in: tripIds },
              status: { in: ["HELD", "PENDING", "CONFIRMED"] },
            },
            select: { tripId: true, seatNumber: true },
          });

          semanticTrips.forEach((trip) => {
            if (!resultMap.has(trip.id)) {
              const tripTickets = activeTickets.filter(
                (t) => t.tripId === trip.id,
              );
              const bookedSeatNumbers = tripTickets.map((t) => t.seatNumber);
              const totalSeats = trip.totalSeats ?? 30;

              resultMap.set(trip.id, {
                ...trip,
                totalSeats,
                availableSeats: Math.max(
                  0,
                  totalSeats - bookedSeatNumbers.length,
                ),
                bookedSeatNumbers,
              });
            }
          });
        }
      } catch (aiError: any) {
        console.warn(
          "[AI SEARCH] Lỗi gọi AI, chỉ trả về kết quả Text:",
          aiError.message,
        );
      }
    }

    return Array.from(resultMap.values()).slice(0, limit);
  }
}
