import { Router } from "express";
import { TripController } from "../Controller/tripController";
import { validate } from "../Middleware/validateMiddleware";
import { cacheResponse } from "../Middleware/idempotencyMiddleware";
import {
  createTripSchema,
  updateTripSchema,
  getTripParamSchema,
  searchAiSchema,
} from "../Validation/tripValidation";

const router = Router();

router.post("/", validate(createTripSchema), TripController.createTrip);

router.get("/", cacheResponse(60), TripController.getAllTrips);

router.post(
  "/semantic-search",
  validate(searchAiSchema),
  TripController.searchSemantic,
);

router.get("/:id", validate(getTripParamSchema), TripController.getTripById);

router.patch("/:id", validate(updateTripSchema), TripController.updateTrip);

router.delete("/:id", validate(getTripParamSchema), TripController.deleteTrip);

export default router;
