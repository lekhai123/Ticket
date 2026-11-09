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

router.get("/system-status", AdminController.getPublicHealth);

router.get(
  "/",
  cacheResponse(60),
  rateLimit(200, 60),
  TripController.getAllTrips,
);
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

router.get("/:id", validate(getTripParamSchema), TripController.getTripById);
export default router;
