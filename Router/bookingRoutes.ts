import { Router } from "express";
import { BookingController } from "../Controller/bookingController";
import { authenticateToken } from "../Middleware/authMiddleware";
import { validate } from "../Middleware/validateMiddleware";
import { createBookingSchema } from "../Validation/bookingValidation";

const router = Router();

// Đặt vé
router.post(
  "/",
  authenticateToken,
  validate(createBookingSchema),
  BookingController.createBooking,
);

// Hủy vé
router.delete("/:id", authenticateToken, BookingController.cancelBooking);

// Xem vé của chính mình
router.get("/my-tickets", authenticateToken, BookingController.getUserTickets);

// Admin xem vé của user khác
router.get(
  "/user/:userId",
  authenticateToken,
  BookingController.getUserTickets,
);

export default router;
