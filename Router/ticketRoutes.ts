import { Router } from "express";
import { TicketController } from "../Controller/ticketController";
import { authenticateToken } from "../Middleware/authMiddleware";
import { validate } from "../Middleware/validateMiddleware";
import {
  getUserTicketsSchema,
  cancelTicketSchema,
} from "../Validation/ticketValidation";
import { createBookingSchema } from "../Validation/bookingValidation";

const router = Router();

// POST /api/tickets/book - Đặt vé xe (ACID Transaction trừ tiền + tạo vé)
router.post(
  "/book",
  authenticateToken,
  validate(createBookingSchema),
  TicketController.bookTicket,
);
router.get("/my-tickets", authenticateToken, TicketController.getUserTickets);
// GET /api/tickets/user/:userId - Xem lịch sử vé đã đặt của người dùng
router.get(
  "/user/:userId",
  authenticateToken,
  validate(getUserTicketsSchema),
  TicketController.getUserTickets,
);
router.patch(
  "/:ticketId/cancel",
  authenticateToken,
  validate(cancelTicketSchema),
  TicketController.cancelTicket,
);

export default router;
