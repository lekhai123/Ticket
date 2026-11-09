import type { Request, Response, NextFunction } from "express";
import { TripService } from "../Service/tripService";

// Hàm wrapper bắt lỗi tự động, không cần viết try/catch dài dòng
const catchAsync =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export class TripController {
  static createTrip = catchAsync(async (req: Request, res: Response) => {
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
  });

  static getAllTrips = catchAsync(async (req: Request, res: Response) => {
    // Lấy page và limit từ URL. Nếu không truyền, mặc định page = 1, limit = 12
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 12;

    const trips = await TripService.getAllTripsLogic(page, limit);
    res.status(200).json({ success: true, data: trips });
  });

  static searchSemantic = catchAsync(async (req: Request, res: Response) => {
    const prompt = req.body?.prompt ?? "";
    const limit = req.body?.limit ? Number(req.body.limit) : 5;
    const searchResults = await TripService.searchTripsSemanticLogic(
      prompt,
      limit,
    );
    res.status(200).json({
      success: true,
      message: "Tìm kiếm bằng AI thành công!",
      data: searchResults,
    });
  });

  static getTripById = catchAsync(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const trip = await TripService.getTripByIdLogic(id);
    res.status(200).json({ success: true, data: trip });
  });

  static updateTrip = catchAsync(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const updatedTrip = await TripService.updateTripLogic(id, req.body);
    res.status(200).json({
      success: true,
      message: "Cập nhật chuyến xe thành công!",
      data: updatedTrip,
    });
  });

  static deleteTrip = catchAsync(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    await TripService.deleteTripLogic(id);
    res
      .status(200)
      .json({ success: true, message: "Xóa chuyến xe thành công!" });
  });
  static getAllTripsForAdmin = catchAsync(
    async (req: Request, res: Response) => {
      const trips = await TripService.getAllTripsForAdminLogic();
      res.status(200).json({ success: true, data: trips });
    },
  );
}
