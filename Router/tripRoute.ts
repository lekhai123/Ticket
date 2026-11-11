import { Router } from "express";
import { TripController } from "../Controller/tripController";
import { validate } from "../Middleware/validateMiddleware";
import { authenticateToken, requireAdmin } from "../Middleware/authMiddleware";
import { rateLimit } from "../Middleware/rateLimitMiddleware";
import { AdminController } from "../Controller/adminController";
import {
  createTripSchema,
  updateTripSchema,
  getTripParamSchema,
  searchAiSchema,
} from "../Validation/tripValidation";

const router = Router();

router.get(
  "/system-status",
  rateLimit(120, 60), // Cho phép 120 req/phút/IP (2 req/s) là quá thoải mái cho user thật
  AdminController.getPublicHealth,
);
// BỎ cacheResponse: service đã cache nội bộ + có invalidate khi mutation.
// Middleware cache ở đây chỉ tạo ra lớp stale không bao giờ được dọn.
router.get("/", rateLimit(200, 60), TripController.getAllTrips);

router.post(
  "/semantic-search",
  rateLimit(30, 60),
  validate(searchAiSchema),
  TripController.searchSemantic,
);

router.get(
  "/admin/all",
  authenticateToken,
  requireAdmin,
  TripController.getAllTripsForAdmin,
);
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

// Thêm rateLimit cho detail (trước đây thiếu → có thể bị spam)
router.get(
  "/:id",
  rateLimit(200, 60),
  validate(getTripParamSchema),
  TripController.getTripById,
);

export default router;
