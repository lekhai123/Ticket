// FILE: Middleware/idempotencyMiddleware.ts
import type { Request, Response, NextFunction } from "express";
import { redisPrimary, redisBackup } from "../Utils/redisLock";
import type Redis from "ioredis";

/**
 * Helper lấy Redis Client đang hoạt động (Primary -> Backup)
 */
const getActiveRedis = (): Redis | null => {
  if (redisPrimary.status === "ready" || redisPrimary.status === "connect") {
    return redisPrimary;
  }
  if (
    redisBackup &&
    (redisBackup.status === "ready" || redisBackup.status === "connect")
  ) {
    return redisBackup;
  }
  return null;
};

export const idempotency = (ttlSeconds: number = 86400) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const idempotencyKey = req.headers["x-idempotency-key"] as string;

    // Nếu không có header idempotency key, tiếp tục luồng bình thường
    if (!idempotencyKey) {
      return next();
    }

    const cacheKey = `idempotency:${idempotencyKey}`;
    const activeRedis = getActiveRedis();

    // 1. Kiểm tra cache nếu Redis khả dụng
    if (activeRedis) {
      try {
        const cachedResponse = await activeRedis.get(cacheKey);

        // Nếu request đã được xử lý trước đó -> Trả về kết quả cũ
        if (cachedResponse) {
          const { statusCode, body } = JSON.parse(cachedResponse);
          res.status(statusCode).json(body);
          return;
        }
      } catch (error: any) {
        console.warn(
          `⚠️ [IDEMPOTENCY WARNING] Lỗi đọc Redis: ${error.message}`,
        );
      }
    }

    // 2. Ghi đè res.json để tự động cache response sau khi controller xử lý xong
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const currentRedis = getActiveRedis();
        if (currentRedis) {
          currentRedis
            .setex(
              cacheKey,
              ttlSeconds,
              JSON.stringify({ statusCode: res.statusCode, body }),
            )
            .catch((err) =>
              console.warn(
                `⚠️ [IDEMPOTENCY WARNING] Lỗi ghi Redis: ${err.message}`,
              ),
            );
        }
      }
      return originalJson(body);
    };

    next();
  };
};
