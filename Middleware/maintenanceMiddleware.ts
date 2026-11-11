import type { Request, Response, NextFunction } from "express";
import { redisPrimary } from "../Utils/redisLock";

export const checkMaintenance = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // 1. Lấy trạng thái bảo trì từ Redis
    const isMaintenance = await redisPrimary.get("system:maintenance_mode");

    if (isMaintenance === "true") {
      // 2. Danh sách các API ĐƯỢC PHÉP chạy khi đang bảo trì
      const isAllowedRoute =
        req.path.includes("/webhook") || //BẮT BUỘC: Cho PayOS gọi vào để cộng tiền
        req.path.includes("/admin") || // Admin vẫn được vào để quản lý
        req.path.includes("/login") || // Cho phép đăng nhập
        req.path.includes("/system-status"); // Check health

      // 3. Nếu không nằm trong danh sách được phép -> Chặn lại
      if (!isAllowedRoute) {
        return res.status(503).json({
          success: false,
          code: "MAINTENANCE_MODE",
          message:
            "Hệ thống đang bảo trì nâng cấp PayOS để phục vụ bạn tốt hơn. Vui lòng quay lại sau 10 phút!",
        });
      }
    }

    next();
  } catch (error) {
    // Nếu Redis lỗi, cho qua để không sập toàn bộ hệ thống (Fail-open)
    next();
  }
};
