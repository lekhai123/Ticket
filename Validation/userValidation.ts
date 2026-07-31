// FILE: Validation/userValidation.ts
import { z } from "zod";

export const registerUserSchema = z.object({
  body: z.object({
    email: z
      .string({ message: "Email không được bỏ trống!" })
      .email("Định dạng email không hợp lệ!"),
    password: z
      .string({ message: "Mật khẩu không được bỏ trống!" })
      .min(6, "Mật khẩu phải có ít nhất 6 ký tự!"),
    fullName: z
      .string({ message: "Họ và tên không được bỏ trống!" })
      .min(2, "Họ và tên phải có ít nhất 2 ký tự!"),
  }),
});

export const getUserParamSchema = z.object({
  params: z.object({
    id: z.coerce
      .number({ message: "User ID phải là số!" })
      .positive("User ID phải lớn hơn 0!"),
  }),
});
