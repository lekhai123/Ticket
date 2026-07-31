// FILE: Validation/tripValidation.ts
import { z } from "zod";

/**
 * 1. Schema validate cho việc TẠO MỚI chuyến xe
 */
export const createTripSchema = z.object({
  body: z.object({
    route: z
      .string({ message: "Tuyến đường không được bỏ trống!" })
      .min(5, "Tuyến đường phải có ít nhất 5 ký tự!"),

    description: z
      .string()
      .max(500, "Mô tả không được vượt quá 500 ký tự!")
      .optional(),

    departureAt: z
      .string({ message: "Thời gian khởi hành không được bỏ trống!" })
      .datetime({
        message:
          "Thời gian khởi hành phải đúng định dạng ISO DateTime (VD: 2026-07-17T15:00:00.000Z)!",
      }),

    price: z
      .number({ message: "Giá vé phải là số!" })
      .positive("Giá vé phải là một số dương lớn hơn 0!"),

    totalSeats: z
      .number({ message: "Số lượng ghế phải là số!" })
      .int("Số lượng ghế phải là số nguyên!")
      .positive("Số lượng ghế phải lớn hơn 0!")
      .optional(),
  }),
});

/**
 * 2. Schema validate cho việc CẬP NHẬT chuyến xe
 * Dùng .partial() để biến các trường thành optional + .refine() bắt buộc truyền ít nhất 1 trường
 */
export const updateTripSchema = z.object({
  params: z.object({
    id: z.coerce
      .number({ message: "Trip ID phải là số!" })
      .positive("Trip ID phải lớn hơn 0!"),
  }),
  body: createTripSchema.shape.body
    .partial()
    .refine((data) => Object.keys(data).length > 0, {
      message:
        "Vui lòng cung cấp ít nhất một trường dữ liệu cần cập nhật (route, description, price,...)!",
    }),
});

/**
 * 🌟 3. SCHEMA MỚI: Validate cho các API nhận tham số ID trên URL (GET /:id, DELETE /:id)
 */
export const getTripParamSchema = z.object({
  params: z.object({
    id: z.coerce
      .number({ message: "Trip ID phải là số!" })
      .positive("Trip ID phải lớn hơn 0!"),
  }),
});

/**
 * 🌟 4. SCHEMA MỚI: Validate cho API Tìm kiếm bằng AI (GET /search-ai?query=...&limit=...)
 */
export const searchAiSchema = z.object({
  body: z.object({
    // Đảm bảo nhận prompt từ body, nếu không truyền thì default = ""
    prompt: z.string().optional().default(""),

    // Coerce limit nếu client truyền lên số dạng string hoặc không truyền
    limit: z.coerce
      .number()
      .positive("Limit phải là số dương lớn hơn 0!")
      .optional()
      .default(5),
  }),
});
