// FILE: Routes/tripRoute.ts
import { Router } from "express";
import { TripController } from "../Controller/tripController";
import { validate } from "../Middleware/validateMiddleware";
import {
  createTripSchema,
  updateTripSchema,
  getTripParamSchema,
  searchAiSchema,
} from "../Validation/tripValidation";

const router = Router();

// POST /api/trips - Tạo chuyến xe
router.post("/", validate(createTripSchema), TripController.createTrip);

// GET /api/trips - Lấy tất cả
router.get("/", TripController.getAllTrips);

// GET /api/trips/search-ai - Semantic Search AI
router.post(
  "/semantic-search",
  validate(searchAiSchema),
  TripController.searchSemantic,
);

// GET /api/trips/:id - Chi tiết chuyến xe
router.get("/:id", validate(getTripParamSchema), TripController.getTripById);

// PATCH /api/trips/:id - Cập nhật chuyến xe
router.patch("/:id", validate(updateTripSchema), TripController.updateTrip);

// DELETE /api/trips/:id - Xóa chuyến xe
router.delete("/:id", validate(getTripParamSchema), TripController.deleteTrip);

export default router;
