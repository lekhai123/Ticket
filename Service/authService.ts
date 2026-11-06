import prisma from "../database/prismaClient";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { OtpService } from "./otpService";
import { RevocationService } from "./revocationService";

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET;
if (!ACCESS_TOKEN_SECRET || !REFRESH_TOKEN_SECRET) {
  throw new Error(
    "Thiếu JWT_ACCESS_SECRET hoặc JWT_REFRESH_SECRET trong .env!",
  );
}

export class AuthService {
  /**
   * Đăng nhập hệ thống: Trả về Access Token ngắn hạn & Refresh Token dài hạn
   */
  static async login(data: {
    email: string;
    pass?: string;
    password?: string;
  }) {
    const inputPassword = data.pass || data.password || "";

    // Tìm người dùng theo Email
    const user = await prisma.users.findUnique({
      where: { email: data.email.toLowerCase().trim() },
      include: { wallet: true },
    });

    if (!user) {
      const error: any = new Error("Email hoặc mật khẩu không chính xác!");
      error.statusCode = 400;
      throw error;
    }

    // Kiểm tra Mật khẩu
    const isPasswordValid = await bcrypt.compare(inputPassword, user.password);
    if (!isPasswordValid) {
      const error: any = new Error("Email hoặc mật khẩu không chính xác!");
      error.statusCode = 400;
      throw error;
    }

    // Payload có thêm `type` để phân biệt access/refresh.
    // Đây là lớp chống tấn công "dùng refresh token như access token" và ngược lại.
    const accessPayload = {
      id: user.id,
      userId: user.id,
      email: user.email,
      role: user.role,
      type: "access" as const,
    };

    const refreshPayload = {
      id: user.id,
      userId: user.id,
      type: "refresh" as const,
    };

    // thêm `jwtid` (jti) để có thể revoke khi logout
    const accessToken = jwt.sign(accessPayload, ACCESS_TOKEN_SECRET, {
      expiresIn: "15m",
      jwtid: crypto.randomUUID(),
    });

    const refreshToken = jwt.sign(refreshPayload, REFRESH_TOKEN_SECRET, {
      expiresIn: "7d",
      jwtid: crypto.randomUUID(),
    });

    // Loại bỏ mật khẩu trước khi trả dữ liệu
    const { password, ...userWithoutPassword } = user;

    return {
      accessToken,
      refreshToken,
      user: userWithoutPassword,
    };
  }

  /**
   * Cấp lại Access Token mới dựa vào Refresh Token (có ROTATION)
   * LƯU Ý QUAN TRỌNG: Hàm này giờ trả THÊM field `refreshToken`.
   * Controller PHẢI set lại cookie `refreshToken` mới.
   * Nếu không set, lần refresh kế tiếp user sẽ bị logout (vì token cũ đã bị revoke).
   */
  static async refreshToken(refreshToken: string) {
    try {
      // 1. Verify Refresh Token
      const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as {
        id: number;
        userId?: number;
        type?: string;
        jti?: string;
        exp?: number;
      };

      // bắt buộc phải là refresh token
      if (decoded.type !== "refresh") {
        throw new Error("Sai loại token!");
      }

      // kiểm tra token đã bị thu hồi chưa (logout/rotation trước đó)
      if (decoded.jti && (await RevocationService.isRevoked(decoded.jti))) {
        throw new Error("Refresh token đã bị thu hồi!");
      }

      // Lấy lại thông tin User mới nhất
      const user = await prisma.users.findUnique({
        where: {
          id: decoded.id ?? decoded.userId!,
        },
        include: {
          wallet: true,
        },
      });

      if (!user) {
        const error: any = new Error("Người dùng không tồn tại!");
        error.statusCode = 401;
        throw error;
      }

      // rotation — revoke token cũ trước khi cấp mới
      if (decoded.jti && decoded.exp) {
        await RevocationService.revoke(decoded.jti, decoded.exp);
      }

      // 3. Tạo Access Token mới
      const newAccessToken = jwt.sign(
        {
          id: user.id,
          userId: user.id,
          email: user.email,
          role: user.role,
          type: "access",
        },
        ACCESS_TOKEN_SECRET,
        {
          expiresIn: "15m",
          jwtid: crypto.randomUUID(),
        },
      );

      // tạo luôn Refresh Token mới
      const newRefreshToken = jwt.sign(
        {
          id: user.id,
          userId: user.id,
          type: "refresh",
        },
        REFRESH_TOKEN_SECRET,
        {
          expiresIn: "7d",
          jwtid: crypto.randomUUID(),
        },
      );

      // Không trả password
      const { password, ...userWithoutPassword } = user;

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken, // THÊM MỚI — controller cần set cookie
        user: userWithoutPassword,
      };
    } catch (err: any) {
      if (err.statusCode) throw err;
      const error: any = new Error(
        "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!",
      );
      error.statusCode = 401;
      throw error;
    }
  }

  /**
   *  Đăng ký thông thường (không OTP)
   */
  static async register(data: {
    fullName: string;
    email: string;
    password: string;
  }) {
    const { fullName, email, password } = data;
    const cleanEmail = email.toLowerCase().trim();

    const existingUser = await prisma.users.findUnique({
      where: { email: cleanEmail },
    });

    if (existingUser) {
      const error: any = new Error("Email đã được sử dụng!");
      error.statusCode = 400;
      throw error;
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = await prisma.users.create({
      data: {
        fullName,
        email: cleanEmail,
        password: hashedPassword,
        role: "CUSTOMER",
        wallet: {
          create: { balance: 0.0 },
        },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return newUser;
  }

  /**
   * 3. Yêu cầu gửi OTP
   */
  static async requestOtp(email: string, type: "REGISTER" | "FORGOT_PASSWORD") {
    const cleanEmail = email.toLowerCase().trim();

    if (type === "REGISTER") {
      const existingUser = await prisma.users.findUnique({
        where: { email: cleanEmail },
      });
      if (existingUser) {
        const error: any = new Error("Email này đã được sử dụng!");
        error.statusCode = 400;
        throw error;
      }
    } else if (type === "FORGOT_PASSWORD") {
      const user = await prisma.users.findUnique({
        where: { email: cleanEmail },
      });
      if (!user) {
        const error: any = new Error("Email không tồn tại trong hệ thống!");
        error.statusCode = 404;
        throw error;
      }
    }

    return await OtpService.createOTPLogic(cleanEmail, type);
  }

  /**
   * Đăng ký tài khoản kèm OTP
   */
  static async completeRegister(data: {
    fullName: string;
    email: string;
    password: string;
    otp: string;
  }) {
    const { fullName, email, password, otp } = data;
    const cleanEmail = email.toLowerCase().trim();

    const existingUser = await prisma.users.findUnique({
      where: { email: cleanEmail },
    });
    if (existingUser) {
      const error: any = new Error("Email này đã được đăng ký sử dụng!");
      error.statusCode = 400;
      throw error;
    }

    await OtpService.verifyOTPLogic(cleanEmail, otp, "REGISTER");

    const hashedPassword = await bcrypt.hash(password, 10);

    return await prisma.$transaction(async (tx) => {
      const newUser = await tx.users.create({
        data: {
          fullName,
          email: cleanEmail,
          password: hashedPassword,
          role: "CUSTOMER",
          wallet: {
            create: {
              balance: 0.0,
            },
          },
        },
        include: {
          wallet: true,
        },
      });

      const { password: _, ...userWithoutPassword } = newUser;
      return userWithoutPassword;
    });
  }

  /**
   * Đặt lại mật khẩu qua OTP
   */
  static async resetPassword(data: any) {
    const { email, otp, newPassword } = data;
    const cleanEmail = email.toLowerCase().trim();

    const user = await prisma.users.findUnique({
      where: { email: cleanEmail },
    });
    if (!user) {
      const error: any = new Error("Tài khoản không tồn tại!");
      error.statusCode = 404;
      throw error;
    }

    await OtpService.verifyOTPLogic(cleanEmail, otp, "FORGOT_PASSWORD");

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // KHÔNG trả về `password` (code gốc `prisma.users.update` trả nguyên
    // object user gồm cả password đã hash → lộ hash cho client!)
    return await prisma.users.update({
      where: { id: user.id },
      data: { password: hashedPassword },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
      },
    });
  }
}
