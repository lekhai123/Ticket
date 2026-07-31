import { z } from "zod";

const ALLOWED_TYPES = ["REGISTER", "FORGOT_PASSWORD"] as const;

// 1. Validate khi Client bấm nút "Gửi mã OTP"
export const requestOTPSchema = z.object({
  body: z.object({
    email: z
      .string({ message: "Email không được bỏ trống!" })
      .trim()
      .email("Định dạng email không hợp lệ!"),
    type: z
      .string()
      .refine((val) => ALLOWED_TYPES.includes(val as any), {
        message: "Loại OTP phải là REGISTER hoặc FORGOT_PASSWORD!",
      })
      .optional()
      .default("REGISTER"),
  }),
});

// 2. Validate khi Client bấm nút "Xác nhận OTP"
export const verifyOTPSchema = z.object({
  body: z.object({
    email: z
      .string({ message: "Email không được bỏ trống!" })
      .trim()
      .email("Định dạng email không hợp lệ!"),
    code: z
      .string({ message: "Mã OTP không được bỏ trống!" })
      .trim()
      .length(6, "Mã OTP phải có đúng 6 ký tự số!")
      .regex(/^\d+$/, "Mã OTP chỉ được chứa ký tự số (0-9)!"),
    type: z
      .string()
      .refine((val) => ALLOWED_TYPES.includes(val as any), {
        message: "Loại OTP phải là REGISTER hoặc FORGOT_PASSWORD!",
      })
      .optional()
      .default("REGISTER"),
  }),
});
