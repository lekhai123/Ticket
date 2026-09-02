// FILE: Service/tripService.ts
import prisma from "../database/prismaClient";
import { MultiLevelCache } from "./cacheService";
import { AIProxyService } from "./aiProxy.service";

export class TripService {
  private static CACHE_KEY_ALL_TRIPS = "trips:all";

  static async getEmbedding(text: string): Promise<number[]> {
    return await AIProxyService.getEmbeddingWithFallback(text);
  }

  /**
   * Helper: Chuẩn hóa dữ liệu chuyến xe kèm số ghế thực tế
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
      bookedSeatNumbers, // Danh sách các số ghế đã có người giữ/mua
    };
  }

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

    await prisma.$executeRawUnsafe(
      `INSERT INTO "Trips" (route, description, "departureAt", price, "totalSeats", embedding) 
       VALUES ($1, $2, $3, $4, $5, $6::vector)`,
      trimmedRoute,
      trimmedDesc || null,
      new Date(departureAt),
      price,
      finalSeats,
      vectorString,
    );

    const createdTrip = await prisma.trips.findFirst({
      where: { route: trimmedRoute, price: price },
      orderBy: { id: "desc" },
    });

    await MultiLevelCache.invalidate(this.CACHE_KEY_ALL_TRIPS);
    return createdTrip;
  }

  static async getAllTripsLogic() {
    const now = new Date();

    // Query trực tiếp các chuyến có giờ khởi hành trong tương lai
    const trips = await prisma.trips.findMany({
      where: {
        departureAt: {
          gt: now, // 👈 Chỉ lấy các chuyến chưa chạy
        },
      },
      orderBy: { departureAt: "asc" },
      include: {
        tickets: {
          where: { status: { in: ["HELD", "PENDING", "CONFIRMED"] } },
          select: { seatNumber: true },
        },
      },
    });

    return trips.map((trip) => this.formatTripWithSeats(trip));
  }

  static async getTripByIdLogic(id: number) {
    const cacheKey = `trips:detail:${id}`;
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
    // Cache ngắn 10 giây cho chi tiết đặt vé tránh tình trạng giữ ghế bị stale
    await MultiLevelCache.set(cacheKey, formatted, 10);
    return formatted;
  }

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

    await MultiLevelCache.invalidate(this.CACHE_KEY_ALL_TRIPS);
    await MultiLevelCache.invalidate(`trips:detail:${id}`);

    return updatedTrip;
  }

  static async deleteTripLogic(id: number) {
    // Kiểm tra nếu chuyến đã có người đặt vé thành công thì chặn xoá
    const hasTickets = await prisma.tickets.findFirst({
      where: { tripId: id, status: "CONFIRMED" },
    });
    if (hasTickets) {
      throw new Error(
        "Không thể xoá chuyến xe đã có vé thanh toán thành công!",
      );
    }

    // Xoá các vé nháp/hết hạn trước nếu có ràng buộc khoá ngoại
    await prisma.tickets.deleteMany({ where: { tripId: id } });

    const deletedTrip = await prisma.trips.delete({ where: { id } });

    await MultiLevelCache.invalidate(this.CACHE_KEY_ALL_TRIPS);
    await MultiLevelCache.invalidate(`trips:detail:${id}`);

    return deletedTrip;
  }

  static async searchTripsSemanticLogic(prompt: string = "", limit = 10) {
    const safePrompt = typeof prompt === "string" ? prompt : "";
    const cleanPrompt = safePrompt.trim().toLowerCase();

    // 1. Nếu không nhập gì hoặc yêu cầu xem hết
    if (
      !cleanPrompt ||
      cleanPrompt.includes("tất cả") ||
      cleanPrompt.includes("danh sách") ||
      cleanPrompt.includes("mặc định")
    ) {
      return await this.getAllTripsLogic();
    }

    // 2. BƯỚC 1: Tìm kiếm chính xác / gần đúng theo Text (ILIKE) trước
    // Giúp các từ khóa cụ thể như "Đà Nẵng", "Hải Phòng", "Nha Trang" lọc chính xác 100%
    const keywordTrips = await prisma.trips.findMany({
      where: {
        departureAt: { gt: new Date() },
        OR: [
          { route: { contains: cleanPrompt, mode: "insensitive" } },
          { description: { contains: cleanPrompt, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { departureAt: "asc" },
      include: {
        tickets: {
          where: { status: { in: ["HELD", "PENDING", "CONFIRMED"] } },
          select: { seatNumber: true },
        },
      },
    });

    // Nếu tìm thấy theo từ khóa địa danh, trả về ngay (không bị dính chuyến xe khác)
    if (keywordTrips.length > 0) {
      return keywordTrips.map((trip) => this.formatTripWithSeats(trip));
    }

    // 3. BƯỚC 2: Nếu người dùng nhập câu tự nhiên ("tìm xe đi sáng mai giá rẻ") -> Dùng Semantic Search
    const queryVector = await this.getEmbedding(cleanPrompt);
    const vectorString = `[${queryVector.join(",")}]`;

    // 🎯 NÂNG NGƯỠNG LÊN 0.70 (Tránh bắt nhầm các địa danh không liên quan)
    const SIMILARITY_THRESHOLD = 0.7;

    const trips: any[] = await prisma.$queryRaw`
    SELECT id, route, "departureAt", price, "totalSeats", description,
           1 - (embedding <=> ${vectorString}::vector) AS similarity
    FROM "Trips"
    WHERE "departureAt" > NOW()
      AND 1 - (embedding <=> ${vectorString}::vector) > ${SIMILARITY_THRESHOLD}
    ORDER BY similarity DESC
    LIMIT ${limit};
  `;

    if (!trips || trips.length === 0) {
      return []; // Trả về rỗng thay vì hiện bừa chuyến Hà Nội - Hải Phòng
    }

    // Bổ sung số ghế thực tế cho các chuyến tìm được
    const tripIds = trips.map((t) => t.id);
    const activeTickets = await prisma.tickets.findMany({
      where: {
        tripId: { in: tripIds },
        status: { in: ["HELD", "PENDING", "CONFIRMED"] },
      },
      select: { tripId: true, seatNumber: true },
    });

    return trips.map((trip) => {
      const tripTickets = activeTickets.filter((t) => t.tripId === trip.id);
      const bookedSeatNumbers = tripTickets.map((t) => t.seatNumber);
      const totalSeats = trip.totalSeats ?? 30;
      return {
        ...trip,
        totalSeats,
        availableSeats: Math.max(0, totalSeats - bookedSeatNumbers.length),
        bookedSeatNumbers,
      };
    });
  }
}
