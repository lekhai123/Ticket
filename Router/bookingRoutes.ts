import { Router } from "express";
import { BookingController } from "../Controller/bookingController";
import { authenticateToken } from "../Middleware/authMiddleware";
import { validate } from "../Middleware/validateMiddleware";
import { createBookingSchema } from "../Validation/bookingValidation";
import { rateLimit } from "../Middleware/rateLimitMiddleware";

const router = Router();

// Đặt vé
router.post(
  "/",
  authenticateToken,
  rateLimit(10, 60), // 10 lần đặt vé / phút / IP
  validate(createBookingSchema),
  BookingController.createBooking,
);

// Hủy vé
router.delete(
  "/:id",
  authenticateToken,
  rateLimit(10, 60),
  BookingController.cancelBooking,
);

// Xem vé
router.get("/my-tickets", authenticateToken, BookingController.getUserTickets);
router.get(
  "/user/:userId",
  authenticateToken,
  BookingController.getUserTickets,
);

export default router;
