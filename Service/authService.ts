// FILE: Services/authService.ts
import prisma from "../database/prismaClient";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OtpService } from "./otpService";

// Lấy Secret Key từ file config/env
const ACCESS_TOKEN_SECRET =
  process.env.JWT_ACCESS_SECRET || "access_secret_key";
const REFRESH_TOKEN_SECRET =
  process.env.JWT_REFRESH_SECRET || "refresh_secret_key";

export class AuthService {
  /**
   * 🎯 1. Đăng nhập hệ thống: Trả về Access Token ngắn hạn & Refresh Token dài hạn
   */
  static async login(data: {
    email: string;
    pass?: string;
    password?: string;
  }) {
    const inputPassword = data.pass || data.password || "";

    // 1. Tìm người dùng theo Email
    const user = await prisma.users.findUnique({
      where: { email: data.email.toLowerCase().trim() },
      include: { wallet: true },
    });

    if (!user) {
      const error: any = new Error("Email hoặc mật khẩu không chính xác!");
      error.statusCode = 400;
      throw error;
    }

    // 2. Kiểm tra Mật khẩu
    const isPasswordValid = await bcrypt.compare(inputPassword, user.password);
    if (!isPasswordValid) {
      const error: any = new Error("Email hoặc mật khẩu không chính xác!");
      error.statusCode = 400;
      throw error;
    }

    // 3. Tạo Payload chuẩn cho JWT
    const payload = {
      id: user.id,
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    // 🎯 4. Tạo cặp Access Token (15 phút) và Refresh Token (7 ngày)
    const accessToken = jwt.sign(payload, ACCESS_TOKEN_SECRET, {
      expiresIn: "15m",
    });

    const refreshToken = jwt.sign(payload, REFRESH_TOKEN_SECRET, {
      expiresIn: "7d",
    });

    // 5. Loại bỏ mật khẩu trước khi trả dữ liệu
    const { password, ...userWithoutPassword } = user;

    return {
      accessToken,
      refreshToken,
      user: userWithoutPassword,
    };
  }

  /**
   * 🎯 1b. Cấp lại Access Token mới dựa vào Refresh Token
   */
  /**
   * 🎯 Cấp lại Access Token từ Refresh Token
   */
  static async refreshToken(refreshToken: string) {
    try {
      // 1. Verify Refresh Token
      const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as {
        id: number;
        userId?: number;
      };

      // 2. Lấy lại thông tin User mới nhất
      const user = await prisma.users.findUnique({
        where: {
          id: decoded.id ?? decoded.userId,
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

      // 3. Tạo Access Token mới
      const accessToken = jwt.sign(
        {
          id: user.id,
          userId: user.id,
          email: user.email,
          role: user.role,
        },
        ACCESS_TOKEN_SECRET,
        {
          expiresIn: "15m",
        },
      );

      // 4. Không trả password
      const { password, ...userWithoutPassword } = user;

      return {
        accessToken,
        user: userWithoutPassword,
      };
    } catch {
      const error: any = new Error(
        "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!",
      );
      error.statusCode = 401;
      throw error;
    }
  }
  /**
   * 🎯 2. Đăng ký thông thường
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
   * 🎯 3. Yêu cầu gửi OTP
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
   * 🎯 4. Đăng ký tài khoản kèm OTP
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
   * 🎯 5. Khôi phục / Đặt lại mật khẩu qua OTP
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

    return await prisma.users.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });
  }
}
