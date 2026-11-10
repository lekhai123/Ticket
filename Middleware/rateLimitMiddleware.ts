import type { Request, Response, NextFunction } from "express";
import { RateLimiter } from "../Utils/rateLimiter";

export const rateLimit = (limit: number, windowInSeconds: number) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // ✅ VÔ HIỆU HÓA RATE LIMIT ĐỂ CHẠY LOAD TEST
    return next();

    /* 
    // PHẦN CODE CŨ BỊ VÔ HIỆU HÓA TẠM THỜI
    try {
      const ip =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        "127.0.0.1";

      const isAllowed = await RateLimiter.consume(ip, limit, windowInSeconds);

      if (!isAllowed) {
        return res.status(429).json({
          success: false,
          message: "Bạn đã thao tác quá nhanh. Vui lòng thử lại sau!",
        });
      }

      next();
    } catch (error) {
      next();
    }
    */
  };
};
