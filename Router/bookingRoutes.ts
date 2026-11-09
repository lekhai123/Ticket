import { Router } from "express";
import { BookingController } from "../Controller/bookingController";
import { authenticateToken } from "../Middleware/authMiddleware";
import { validate } from "../Middleware/validateMiddleware";
import { createBookingSchema } from "../Validation/bookingValidation";
import { rateLimit } from "../Middleware/rateLimitMiddleware";

const router = Router();

router.post(
  "/",
  authenticateToken,
  rateLimit(60, 60),
  validate(createBookingSchema),
  BookingController.createBooking,
);

router.delete(
  "/:id",
  authenticateToken,
  rateLimit(60, 60),
  BookingController.cancelBooking,
);

router.get("/my-tickets", authenticateToken, BookingController.getUserTickets);
router.get(
  "/user/:userId",
  authenticateToken,
  BookingController.getUserTickets,
);

export default router;
