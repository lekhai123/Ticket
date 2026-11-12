import type { Request, Response, NextFunction } from "express";
import { redisPrimary, redisBackup } from "../Utils/redisLock";

export const checkMaintenance = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // 1. KILL SWITCH: Ưu tiên check biến môi trường (Dành cho khẩn cấp)
    let isMaintenance = process.env.FORCE_MAINTENANCE === "true";

    // 2. Nếu Env không bật, thử đọc từ Redis
    if (!isMaintenance) {
      let activeRedis = redisPrimary;
      if (
        redisPrimary.status !== "ready" &&
        redisBackup &&
        redisBackup.status === "ready"
      ) {
        activeRedis = redisBackup;
      }

      try {
        const redisStatus = await activeRedis.get("system:maintenance_mode");
        if (redisStatus === "true") isMaintenance = true;
      } catch (redisErr) {
        console.warn(
          "[MAINTENANCE] Không đọc được Redis. Bỏ qua check bảo trì.",
        );
      }
    }

    if (isMaintenance) {
      const isAuthRoute =
        req.path.includes("/login") ||
        req.path.includes("/refresh-token") ||
        req.path.includes("/auth/me");

      const isSystemRoute =
        req.path.includes("/webhook") ||
        req.path.includes("/admin") ||
        req.path.includes("/system-status");

      const isReadOnly = req.method === "GET";

      const isAllowedRoute = isAuthRoute || isSystemRoute || isReadOnly;

      if (!isAllowedRoute) {
        return res.status(503).json({
          success: false,
          code: "MAINTENANCE_MODE",
          message:
            "Hệ thống đang bảo trì để thay thế Redis. Vui lòng quay lại sau!",
        });
      }
    }

    next();
  } catch (error) {
    next();
  }
};
