// FILE: Controller/tripController.ts
import type { Request, Response } from "express";
import { TripService } from "../Service/tripService";

export class TripController {
  /**
   * POST /api/trips
   * Tạo mới chuyến xe thông minh (Tự động sinh Vector)
   */
  static async createTrip(req: Request, res: Response): Promise<void> {
    const { route, description, departureAt, price, totalSeats } = req.body;

    const tripData = await TripService.createTripLogic(
      route,
      description,
      departureAt,
      price,
      totalSeats,
    );

    res.status(201).json({
      success: true,
      message: "Tạo chuyến xe thông minh thành công!",
      data: tripData,
    });
  }

  /**
   * GET /api/trips
   * Lấy danh sách toàn bộ chuyến xe thông thường
   */
  static async getAllTrips(req: Request, res: Response): Promise<void> {
    const trips = await TripService.getAllTripsLogic();
    res.status(200).json({
      success: true,
      data: trips,
    });
  }

  /**
   * GET /api/trips/search-ai?query=...&limit=...
   * 🌟 Tìm kiếm chuyến xe thông minh bằng ngôn ngữ tự nhiên
   */
  static async searchSemantic(req: Request, res: Response): Promise<void> {
    try {
      // 1. Lấy prompt và limit từ req.body (đã qua Zod validate & default fallback)
      const prompt = req.body?.prompt ?? "";
      const limit = req.body?.limit ? Number(req.body.limit) : 5;

      // 2. Gọi Service xử lý logic
      const searchResults = await TripService.searchTripsSemanticLogic(
        prompt,
        limit,
      );

      res.status(200).json({
        success: true,
        message: "Tìm kiếm bằng AI thành công!",
        data: searchResults,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Lỗi máy chủ khi tìm kiếm AI",
      });
    }
  }

  /**
   * GET /api/trips/:id
   * Lấy chi tiết 1 chuyến xe
   */
  static async getTripById(req: Request, res: Response): Promise<void> {
    // req.params.id đã được z.coerce.number() ép sang kiểu number
    const id = Number(req.params.id);

    // Lỗi không tìm thấy (404) nên để TripService chủ động throw CustomError
    const trip = await TripService.getTripByIdLogic(id);

    res.status(200).json({
      success: true,
      data: trip,
    });
  }

  /**
   * PATCH / PUT /api/trips/:id
   * Cập nhật thông tin chuyến xe
   */
  static async updateTrip(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);

    const updatedTrip = await TripService.updateTripLogic(id, req.body);

    res.status(200).json({
      success: true,
      message: "Cập nhật chuyến xe thành công!",
      data: updatedTrip,
    });
  }

  /**
   * DELETE /api/trips/:id
   * Xóa chuyến xe
   */
  static async deleteTrip(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);

    await TripService.deleteTripLogic(id);

    res.status(200).json({
      success: true,
      message: "Xóa chuyến xe thành công!",
    });
  }
}
