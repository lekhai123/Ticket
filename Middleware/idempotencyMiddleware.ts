import type { Request, Response, NextFunction } from "express";
import { redisPrimary, redisBackup } from "../Utils/redisLock";
import type Redis from "ioredis";
import crypto from "crypto";

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

    // 1. Tạo Hash từ Payload (để đảm bảo cùng 1 key phải gửi cùng dữ liệu)
    let payloadHash = "";
    try {
      payloadHash = crypto
        .createHash("sha256")
        .update(JSON.stringify(req.body || {}))
        .digest("hex");
    } catch {
      payloadHash = "hash_error";
    }

    const cacheKey = `idempotency:${idempotencyKey}`;
    const activeRedis = getActiveRedis();

    if (activeRedis) {
      try {
        // 2. Khóa bằng NX, lưu kèm Hash của Payload
        const processingValue = JSON.stringify({
          status: "PROCESSING",
          hash: payloadHash,
        });
        const isLocked = await activeRedis.set(
          cacheKey,
          processingValue,
          "EX",
          60, // Khóa 60s
          "NX",
        );

        if (isLocked === null) {
          const cachedData = await activeRedis.get(cacheKey);

          if (cachedData) {
            const parsedData = JSON.parse(cachedData);

            // Nếu đang xử lý, kiểm tra xem Payload có bị đổi không
            if (parsedData.status === "PROCESSING") {
              if (parsedData.hash !== payloadHash) {
                res.status(400).json({
                  success: false,
                  message: "Idempotency Key đã được dùng với dữ liệu khác!",
                });
                return;
              }
              res.status(409).json({
                success: false,
                message:
                  "Yêu cầu này đang được xử lý, vui lòng không gửi liên tục!",
              });
              return;
            }

            // Nếu đã xử lý xong -> Trả lại kết quả cũ
            if (parsedData.statusCode && parsedData.body) {
              res.status(parsedData.statusCode).json(parsedData.body);
              return;
            }
          }
        }
      } catch (error: any) {
        console.warn(`[IDEMPOTENCY WARNING] Lỗi Redis: ${error.message}`);
      }
    }

    // 3. Can thiệp vào hàm res.json để dọn dẹp hoặc lưu kết quả
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      const currentRedis = getActiveRedis();
      if (currentRedis) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // Thành công -> Lưu kết quả vào Redis để trả lại cho request sau
          currentRedis
            .setex(
              cacheKey,
              ttlSeconds,
              JSON.stringify({ statusCode: res.statusCode, body }),
            )
            .catch(() => {});
        } else if (res.statusCode >= 400) {
          // Lỗi nghiệp vụ (400, 500) -> Xóa khóa PROCESSING để user được phép thử lại
          currentRedis.del(cacheKey).catch(() => {});
        }
      }
      return originalJson(body);
    };

    next();
  };
};
