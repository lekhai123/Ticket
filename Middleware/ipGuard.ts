// src/middlewares/ipGuard.ts
import type { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const checkIpBlacklist = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Bắt Client IP thực kể cả khi chạy sau Nginx / Cloudflare / Proxy
    const clientIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      (req.headers["cf-connecting-ip"] as string) ||
      req.socket.remoteAddress ||
      "127.0.0.1";

    const blacklisted = await prisma.blacklistedIPs.findFirst({
      where: {
        ipAddress: clientIp,
        isResolved: false,
      },
    });

    if (blacklisted) {
      return res.status(403).json({
        success: false,
        code: "IP_BLOCKED",
        message: `⛔ IP của bạn (${clientIp}) bị hạn chế đăng ký tài khoản mới do liên quan đến khoản nợ/vi phạm chưa xử lý.`,
      });
    }

    next();
  } catch (error) {
    next(); // Trường hợp lỗi DB vẫn cho đi tiếp để không gián đoạn
  }
};
