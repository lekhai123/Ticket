import { Router } from "express";
import { TripController } from "../Controller/tripController";
import { validate } from "../Middleware/validateMiddleware";
import { cacheResponse } from "../Middleware/idempotencyMiddleware";
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

// 1. API CÔNG KHAI
router.get("/system-status", AdminController.getPublicHealth);

router.get(
  "/",
  cacheResponse(60),
  rateLimit(30, 60),
  TripController.getAllTrips,
);
router.post(
  "/semantic-search",
  rateLimit(10, 60), // AI tốn token, chỉ cho 10 lần / phút
  validate(searchAiSchema),
  TripController.searchSemantic,
);

// 2. API ADMIN
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

// 3. API LẤY CHI TIẾT
router.get("/:id", validate(getTripParamSchema), TripController.getTripById);
export default router;
