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

router.post(
  "/book",
  authenticateToken,
  validate(createBookingSchema),
  TicketController.bookTicket,
);

router.get("/my-tickets", authenticateToken, TicketController.getUserTickets);

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
