// FILE: Validation/authValidation.ts
import { z } from "zod";

const ALLOWED_TYPES = ["REGISTER", "FORGOT_PASSWORD"] as const;

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Email không hợp lệ"),
    password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
  }),
});

export const registerSchema = z.object({
  body: z.object({
    fullName: z
      .string({ message: "Họ tên không được bỏ trống" })
      .min(2, "Họ tên phải có ít nhất 2 ký tự"),
    email: z
      .string({ message: "Email không được bỏ trống" })
      .email("Email không đúng định dạng"),
    password: z
      .string({ message: "Mật khẩu không được bỏ trống" })
      .min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
  }),
});

export const requestOtpSchema = z.object({
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

export const completeRegisterSchema = z.object({
  body: z.object({
    fullName: z.string().min(2, "Họ tên phải từ 2 ký tự"),
    email: z.string().trim().email("Email không hợp lệ"),
    password: z.string().min(6, "Mật khẩu phải từ 6 ký tự"),
    otp: z.string().trim().length(6, "Mã OTP phải đúng 6 ký tự"),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    email: z.string().trim().email("Email không hợp lệ"),
    otp: z.string().trim().length(6, "Mã OTP phải đúng 6 ký tự"),
    newPassword: z.string().min(6, "Mật khẩu mới phải từ 6 ký tự"),
  }),
});
