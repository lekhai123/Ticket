import type { Request, Response, NextFunction } from "express";
import { redisPrimary } from "../Utils/redisLock";

export const checkMaintenance = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const isMaintenance = await redisPrimary.get("system:maintenance_mode");

    if (isMaintenance === "true") {
      // 1. Danh sách API BẮT BUỘC PHẢI CHẠY để duy trì phiên đăng nhập
      const isAuthRoute =
        req.path.includes("/login") ||
        req.path.includes("/refresh-token") ||
        req.path.includes("/auth/me");

      const isSystemRoute =
        req.path.includes("/webhook") ||
        req.path.includes("/admin") ||
        req.path.includes("/system-status");

      // 2. Cho phép tất cả các request GET (chỉ đọc dữ liệu) để user xem được vé, ví
      const isReadOnly = req.method === "GET";

      const isAllowedRoute = isAuthRoute || isSystemRoute || isReadOnly;

      if (!isAllowedRoute) {
        return res.status(503).json({
          success: false,
          code: "MAINTENANCE_MODE",
          message:
            "Hệ thống đang bảo trì nâng cấp để phục vụ bạn tốt hơn. Vui lòng quay lại sau ít phút!",
        });
      }
    }

    next();
  } catch (error) {
    next();
  }
};
