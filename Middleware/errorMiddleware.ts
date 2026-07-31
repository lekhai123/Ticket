// FILE: Middleware/errorMiddleware.ts
import type { Request, Response, NextFunction } from "express";

export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  console.error("❌ [SERVER ERROR]:", err);

  let statusCode = err.statusCode || 500;
  let message =
    err.message || "Đã có lỗi hệ thống xảy ra, vui lòng thử lại sau!";

  if (err.code === "P2002") {
    statusCode = 400;
    message = `Dữ liệu bị trùng lặp! Trường [${err.meta?.target}] đã tồn tại trong hệ thống.`;
  }

  res.status(statusCode).json({
    success: false,
    message: message,
    details: err.details || undefined, // 🌟 Thêm dòng này để trả về chi tiết lỗi từ Zod
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};
