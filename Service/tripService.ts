// FILE: Service/tripService.ts
import prisma from "../database/prismaClient";
import { GoogleGenAI } from "@google/genai";
import { MultiLevelCache } from "./cacheService"; // 👈 1. Import MultiLevelCache
import { AIProxyService } from "./aiProxy.service"; // 👈 Import AIProxyService

// Khởi tạo Google AI với API Key từ file .env
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export class TripService {
  /**
   * Key dùng chung cho Cache danh sách chuyến xe
   */
  private static CACHE_KEY_ALL_TRIPS = "trips:all";

  /**
   * Hàm helper để chuyển đổi văn bản thành Vector bằng Gemini
   */
  static async getEmbedding(text: string): Promise<number[]> {
    return await AIProxyService.getEmbeddingWithFallback(text);
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
    const finalSeats = totalSeats ?? 30;
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

    // 🌟 INVALIDATE CACHE: Xóa cache danh sách cũ để lần GET sau đọc data mới nhất
    await MultiLevelCache.invalidate(this.CACHE_KEY_ALL_TRIPS);

    return createdTrip;
  }

  /**
   * Lấy danh sách toàn bộ chuyến xe (Đã tích hợp Multi-Level Cache)
   */
  static async getAllTripsLogic() {
    // 🌟 BƯỚC 1: Đọc từ Cache (RAM / Redis) trước
    const cachedTrips = await MultiLevelCache.get(this.CACHE_KEY_ALL_TRIPS);
    if (cachedTrips) {
      // Cache Hit -> Phản hồi siêu tốc (< 5ms)
      return cachedTrips;
    }

    // 🌟 BƯỚC 2: Cache Miss -> Mới query Database
    const trips = await prisma.trips.findMany({
      orderBy: { departureAt: "asc" },
    });

    // 🌟 BƯỚC 3: Lưu vào Multi-Level Cache trong 300 giây (5 phút)
    await MultiLevelCache.set(this.CACHE_KEY_ALL_TRIPS, trips, 300);

    return trips;
  }

  /**
   * Lấy chi tiết 1 chuyến xe (Cũng được cache theo ID)
   */
  static async getTripByIdLogic(id: number) {
    const cacheKey = `trips:detail:${id}`;

    const cachedTrip = await MultiLevelCache.get(cacheKey);
    if (cachedTrip) return cachedTrip;

    const trip = await prisma.trips.findUnique({
      where: { id: Number(id) },
      include: {
        tickets: {
          where: {
            status: { in: ["HELD", "PENDING", "CONFIRMED"] }, // Lấy danh sách vé đang có chủ
          },
        },
      },
    });
    if (trip) {
      await MultiLevelCache.set(cacheKey, trip, 300);
    }

    return trip;
  }

  /**
   * Cập nhật thông tin chuyến xe
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
        ...data,
        ...(data.route && { route: data.route.trim() }),
        ...(data.description && { description: data.description.trim() }),
        ...(data.departureAt && { departureAt: new Date(data.departureAt) }),
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

    // 🌟 INVALIDATE CACHE: Xóa cache danh sách & cache chi tiết của item này
    await MultiLevelCache.invalidate(this.CACHE_KEY_ALL_TRIPS);
    await MultiLevelCache.invalidate(`trips:detail:${id}`);

    return updatedTrip;
  }

  /**
   * Xóa chuyến xe
   */
  static async deleteTripLogic(id: number) {
    const deletedTrip = await prisma.trips.delete({
      where: { id },
    });

    // 🌟 INVALIDATE CACHE: Xóa cache khi có dữ liệu bị xóa
    await MultiLevelCache.invalidate(this.CACHE_KEY_ALL_TRIPS);
    await MultiLevelCache.invalidate(`trips:detail:${id}`);

    return deletedTrip;
  }

  static async searchTripsSemanticLogic(prompt: string = "", limit = 5) {
    // Phòng thủ tuyệt đối: Đảm bảo prompt luôn là kiểu string
    const safePrompt = typeof prompt === "string" ? prompt : "";
    const cleanPrompt = safePrompt.trim().toLowerCase();

    // 1. Nếu prompt rỗng hoặc muốn lấy tất cả
    const isGetAll =
      !cleanPrompt ||
      cleanPrompt.includes("tất cả") ||
      cleanPrompt.includes("danh sách") ||
      cleanPrompt.includes("mặc định");

    if (isGetAll) {
      return await prisma.trips.findMany({
        take: limit,
        orderBy: { departureAt: "asc" },
      });
    }

    // 2. Gọi Embedding & PGVector
    const queryVector = await this.getEmbedding(cleanPrompt);
    const vectorString = `[${queryVector.join(",")}]`;

    const trips = await prisma.$queryRaw`
    SELECT id, route, "departureAt", price, "totalSeats", description,
           1 - (embedding <=> ${vectorString}::vector) AS similarity
    FROM "Trips"
    WHERE 1 - (embedding <=> ${vectorString}::vector) > 0.65
    ORDER BY similarity DESC
    LIMIT ${limit};
  `;

    return trips;
  }
}
