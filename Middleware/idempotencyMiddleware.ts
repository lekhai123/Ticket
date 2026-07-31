// FILE: Middleware/idempotencyMiddleware.ts
import type { Request, Response, NextFunction } from "express";
import { redis } from "../Utils/redisLock";

export const idempotency = (ttlSeconds: number = 86400) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const idempotencyKey = req.headers["x-idempotency-key"] as string;

    // Nếu không có header idempotency key, bỏ qua middleware này
    if (!idempotencyKey) {
      return next();
    }

    const cacheKey = `idempotency:${idempotencyKey}`;
    const cachedResponse = await redis.get(cacheKey);

    // Nếu request này đã được xử lý thành công trước đó -> Trả về luôn kết quả cũ từ Redis
    if (cachedResponse) {
      const { statusCode, body } = JSON.parse(cachedResponse);
      res.status(statusCode).json(body);
      return;
    }

    // Ghi đè hàm res.json để tự động lưu response vào Redis sau khi xử lý xong
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        redis.setex(cacheKey, ttlSeconds, JSON.stringify({ statusCode: res.statusCode, body }));
      }
      return originalJson(body);
    };

    next();
  };
};