// FILE: Validation/bookingValidation.ts (hoặc ticketValidation.ts)
import { z } from "zod";

export const createBookingSchema = z.object({
  body: z
    .object({
      tripId: z.coerce.number({ message: "Trip ID không được bỏ trống!" }),

      // 🎯 Hỗ trợ cả seatNumbers (mảng), seatIds (mảng chuỗi), hoặc seatNumber (số đơn)
      seatNumbers: z
        .array(z.coerce.number())
        .min(1, "Số ghế không được bỏ trống!")
        .optional(),
      seatIds: z.array(z.string()).optional(),
      seatNumber: z.coerce.number().optional(),

      paymentMethod: z.enum(["WALLET", "LATER"]).optional(),
    })
    .refine((data) => data.seatNumbers || data.seatIds || data.seatNumber, {
      message: "Số ghế không được bỏ trống!",
      path: ["seatNumbers"],
    }),
});
