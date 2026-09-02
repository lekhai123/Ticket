// FILE: Middleware/tracingMiddleware.ts
import type { Request, Response, NextFunction } from "express";
import crypto from "crypto"; // 👈 Thêm thư viện crypto gốc của Node.js

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export const distributedTracing = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Lấy requestId từ Gateway truyền sang hoặc tự sinh mới bằng crypto gốc
  const requestId =
    (req.headers["x-request-id"] as string) || crypto.randomUUID(); // 👈 Thay uuidv4()
  req.requestId = requestId;
  res.setHeader("X-Request-ID", requestId); // Trả về client để đối soát khi có sự cố
  next();
};
