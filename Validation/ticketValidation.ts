import { z } from "zod";

/**
 * Schema validate cho API Đặt vé xe: POST /api/tickets/book
 */
export const bookTicketSchema = z.object({
  body: z.object({
    userId: z
      .number({ message: "User ID không được bỏ trống!" })
      .positive("User ID phải là số nguyên dương lớn hơn 0!"),

    tripId: z
      .number({ message: "Trip ID không được bỏ trống!" })
      .positive("Trip ID phải là số nguyên dương lớn hơn 0!"),

    seatNumber: z
      .number({ message: "Số ghế không được bỏ trống!" })
      .int("Số ghế phải là số nguyên!")
      .positive("Số ghế phải lớn hơn 0!"),
  }),
});

/**
 * Schema validate cho API Lấy lịch sử vé của User: GET /api/tickets/user/:userId
 */
export const getUserTicketsSchema = z.object({
  params: z.object({
    userId: z.coerce
      .number({ message: "User ID phải là số!" })
      .positive("User ID phải là số nguyên dương lớn hơn 0!"),
  }),
});
export const cancelTicketSchema = z.object({
  // 🎯 Thêm .optional() hoặc .default({}) cho body vì Hủy vé chỉ cần ID ở params
  body: z.object({}).optional(),

  params: z.object({
    ticketId: z.coerce.number({ message: "ID vé không hợp lệ!" }),
  }),
});
