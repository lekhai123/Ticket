import type { Request, Response, NextFunction } from "express";
import prisma from "../database/prismaClient"; // Dùng chung Prisma Client
import { redisPrimary } from "../Utils/redisLock"; // Dùng Redis để cache

export const checkIpBlacklist = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Lấy IP thực (hỗ trợ sau Proxy/Nginx/Cloudflare)
    const clientIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      (req.headers["cf-connecting-ip"] as string) ||
      req.socket.remoteAddress ||
      "127.0.0.1";

    const cacheKey = `ipbl:${clientIp}`;
    let cachedStatus: string | null = null;

    // 1. Check Cache trên Redis trước (giảm tải DB)
    try {
      cachedStatus = await redisPrimary.get(cacheKey);
    } catch (redisErr) {
      console.warn("[IP GUARD] Redis lỗi, fallback xuống DB:", redisErr);
    }

    // Nếu cache trả về "1" (đang bị block)
    if (cachedStatus === "1") {
      return res.status(403).json({
        success: false,
        code: "IP_BLOCKED",
        message: `IP của bạn (${clientIp}) bị hạn chế đăng ký tài khoản mới do liên quan đến khoản nợ/vi phạm chưa xử lý.`,
      });
    }

    // Nếu cache trả về "0" (sạch), cho qua luôn
    if (cachedStatus === "0") {
      return next();
    }

    // 2. Nếu Cache không có (null), mới query DB
    const blacklisted = await prisma.blacklistedIPs.findFirst({
      where: {
        ipAddress: clientIp,
        isResolved: false,
      },
    });

    // Lưu lại kết quả vào Redis trong 30 giây
    try {
      await redisPrimary.set(cacheKey, blacklisted ? "1" : "0", "EX", 30);
    } catch (redisErr) {
      console.warn("[IP GUARD] Không lưu được cache IP:", redisErr);
    }

    if (blacklisted) {
      return res.status(403).json({
        success: false,
        code: "IP_BLOCKED",
        message: `IP của bạn (${clientIp}) bị hạn chế đăng ký tài khoản mới do liên quan đến khoản nợ/vi phạm chưa xử lý.`,
      });
    }

    next();
  } catch (error) {
    // Lỗi DB thì vẫn cho đi tiếp để không gián đoạn hệ thống (Fail-open)
    console.error("[IP GUARD] Lỗi kiểm tra IP:", error);
    next();
  }
};
