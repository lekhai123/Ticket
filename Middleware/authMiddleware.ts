import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/jwt";

export const authenticateToken = (
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

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      console.log("❌ LỖI VERIFY JWT:", err.message);
      return res.status(401).json({
        success: false,
        message: "Token không hợp lệ hoặc đã hết hạn!",
      });
    }

    (req as any).user = decoded;
    next();
  });
};

// Middleware kiểm tra quyền ADMIN
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
