import { Router } from "express";
import { TripController } from "../Controller/tripController";
import { validate } from "../Middleware/validateMiddleware";
import { cacheResponse } from "../Middleware/idempotencyMiddleware";
import { authenticateToken, requireAdmin } from "../Middleware/authMiddleware";
import {
  createTripSchema,
  updateTripSchema,
  getTripParamSchema,
  searchAiSchema,
} from "../Validation/tripValidation";

const router = Router();

// 1. API CÔNG KHAI (Dành cho User)
router.get("/", cacheResponse(60), TripController.getAllTrips);
router.post(
  "/semantic-search",
  validate(searchAiSchema),
  TripController.searchSemantic,
);

// 2. API ADMIN (Đặt trên /:id để tránh bị nhầm)
router.get(
  "/admin/all",
  authenticateToken,
  requireAdmin,
  TripController.getAllTripsForAdmin,
);

// 3. API THÊM / SỬA / XÓA (Dành cho Admin)
router.post(
  "/",
  authenticateToken,
  requireAdmin,
  validate(createTripSchema),
  TripController.createTrip,
);
router.patch(
  "/:id",
  authenticateToken,
  requireAdmin,
  validate(updateTripSchema),
  TripController.updateTrip,
);
router.delete(
  "/:id",
  authenticateToken,
  requireAdmin,
  validate(getTripParamSchema),
  TripController.deleteTrip,
);

// 4. API LẤY CHI TIẾT 1 CHUYẾN XE (Đặt ở cuối cùng)
router.get("/:id", validate(getTripParamSchema), TripController.getTripById);

export default router;
