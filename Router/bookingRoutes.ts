// FILE: Routes/bookingRoutes.ts
import { Router } from "express";
import { BookingController } from "../Controller/bookingController";
import { authenticateToken } from "../Middleware/authMiddleware";
import { validate } from "../Middleware/validateMiddleware";
import { createBookingSchema } from "../Validation/bookingValidation";

const router = Router();

// POST /api/bookings - Chọn & Giữ ghế
router.post(
  "/",
  authenticateToken,
  validate(createBookingSchema),
  BookingController.createBooking,
);

export default router;
