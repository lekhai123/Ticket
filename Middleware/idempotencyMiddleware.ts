import type { Request, Response, NextFunction } from "express";
import { redisPrimary, redisBackup } from "../Utils/redisLock";
import type Redis from "ioredis";

const getActiveRedis = (): Redis | null => {
  if (redisPrimary.status === "ready" || redisPrimary.status === "connect")
    return redisPrimary;
  if (
    redisBackup &&
    (redisBackup.status === "ready" || redisBackup.status === "connect")
  )
    return redisBackup;
  return null;
};

export const idempotency = (ttlSeconds: number = 86400) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const idempotencyKey = req.headers["x-idempotency-key"] as string;

    if (!idempotencyKey) return next();

    const cacheKey = `idempotency:${idempotencyKey}`;
    const activeRedis = getActiveRedis();

    if (activeRedis) {
      try {
        // Dùng SET NX để khóa ngay từ đầu (Chống 2 request đồng thời)
        const isLocked = await activeRedis.set(
          cacheKey,
          "PROCESSING",
          "EX",
          60,
          "NX",
        );

        if (isLocked === null) {
          // Nếu key đã tồn tại (không set được) -> Có request khác đang chạy hoặc đã xong
          const cachedResponse = await activeRedis.get(cacheKey);

          if (cachedResponse === "PROCESSING") {
            res.status(409).json({
              success: false,
              message:
                "Yêu cầu này đang được xử lý, vui lòng không gửi liên tục!",
            });
            return;
          }

          if (cachedResponse) {
            const { statusCode, body } = JSON.parse(cachedResponse);
            res.status(statusCode).json(body);
            return;
          }
        }
      } catch (error: any) {
        console.warn(`[IDEMPOTENCY WARNING] Lỗi Redis: ${error.message}`);
      }
    }

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
                `[IDEMPOTENCY WARNING] Lỗi ghi Redis: ${err.message}`,
              ),
            );
        }
      }
      return originalJson(body);
    };

    next();
  };
};
