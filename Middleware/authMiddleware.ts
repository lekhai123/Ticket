import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/jwt";
import { RevocationService } from "../Service/revocationService";

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access Token không được cung cấp!",
    });
  }

  try {
    // Dùng verify đồng bộ (không truyền callback) để dễ dùng async/await
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    //  Kiểm tra đúng loại token (chặn dùng Refresh Token gọi API)
    if (decoded.type !== "access") {
      return res.status(401).json({
        success: false,
        message: "Sai loại token. Vui lòng sử dụng Access Token!",
      });
    }

    // Kiểm tra xem token đã bị thu hồi chưa (khi user logout)
    const isRevoked = await RevocationService.isRevoked(decoded.jti);
    if (isRevoked) {
      return res.status(401).json({
        success: false,
        message: "Phiên đăng nhập đã kết thúc hoặc token bị thu hồi!",
      });
    }

    // 3. Gắn thông tin user vào request để các controller phía sau dùng
    (req as any).user = decoded;
    next();
  } catch (err: any) {
    console.log("❌ LỖI VERIFY JWT:", err.message);
    return res.status(401).json({
      success: false,
      message: "Token không hợp lệ hoặc đã hết hạn!",
    });
  }
};

// Middleware kiểm tra quyền ADMIN (Giữ nguyên gốc)
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const user = (req as any).user;
  if (user?.role !== "ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Quyền truy cập bị từ chối. Bắt buộc là Tài khoản Admin!",
    });
  }
  next();
};
