import prisma from "../database/prismaClient";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { OtpService } from "./otpService";
import { RevocationService } from "./revocationService";
import { EncryptionService } from "../Utils/encryption"; // ✅ Thêm import mã hóa

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET;
if (!ACCESS_TOKEN_SECRET || !REFRESH_TOKEN_SECRET) {
  throw new Error(
    "Thiếu JWT_ACCESS_SECRET hoặc JWT_REFRESH_SECRET trong .env!",
  );
}

export class AuthService {
  /**
   * Hàm dùng chung để tạo cặp Access Token & Refresh Token
   */
  static generateTokensForUser(user: any) {
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

    const accessToken = jwt.sign(accessPayload, ACCESS_TOKEN_SECRET!, {
      expiresIn: "15m",
      jwtid: crypto.randomUUID(),
    });

    const refreshToken = jwt.sign(refreshPayload, REFRESH_TOKEN_SECRET!, {
      expiresIn: "7d",
      jwtid: crypto.randomUUID(),
    });

    return { accessToken, refreshToken };
  }

  /**
   * Đăng nhập hệ thống
   */
  static async login(data: {
    email: string;
    pass?: string;
    password?: string;
  }) {
    const inputPassword = data.pass || data.password || "";

    const user = await prisma.users.findUnique({
      where: { email: data.email.toLowerCase().trim() },
      include: { wallet: true },
    });

    if (!user) {
      const error: any = new Error("Email hoặc mật khẩu không chính xác!");
      error.statusCode = 400;
      throw error;
    }

    // BẢO MẬT: Nếu user chưa thiết lập mật khẩu (chỉ dùng Passkey)
    if (!user.password) {
      const error: any = new Error(
        "Tài khoản này chưa thiết lập mật khẩu. Vui lòng đăng nhập bằng Vân tay (Passkey)!",
      );
      error.statusCode = 400;
      throw error;
    }

    const isPasswordValid = await bcrypt.compare(inputPassword, user.password);
    if (!isPasswordValid) {
      const error: any = new Error("Email hoặc mật khẩu không chính xác!");
      error.statusCode = 400;
      throw error;
    }

    const tokens = this.generateTokensForUser(user);

    // Loại bỏ mật khẩu và dữ liệu nhạy cảm trước khi trả về
    const { password, currentChallenge, ...userWithoutPassword } = user;

    return {
      ...tokens,
      user: userWithoutPassword,
    };
  }

  /**
   * Cấp lại Access Token mới dựa vào Refresh Token (có ROTATION)
   */
  static async refreshToken(refreshToken: string) {
    try {
      const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET!) as {
        id: number;
        userId?: number;
        type?: string;
        jti?: string;
        exp?: number;
      };

      if (decoded.type !== "refresh") {
        throw new Error("Sai loại token!");
      }

      if (decoded.jti && (await RevocationService.isRevoked(decoded.jti))) {
        throw new Error("Refresh token đã bị thu hồi!");
      }

      const user = await prisma.users.findUnique({
        where: { id: decoded.id ?? decoded.userId! },
        include: { wallet: true },
      });

      if (!user) {
        const error: any = new Error("Người dùng không tồn tại!");
        error.statusCode = 401;
        throw error;
      }

      if (decoded.jti && decoded.exp) {
        await RevocationService.revoke(decoded.jti, decoded.exp);
      }

      const tokens = this.generateTokensForUser(user);
      const { password, currentChallenge, ...userWithoutPassword } = user;

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
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
   * Đăng ký thông thường (không OTP) - CÓ MÃ HÓA SỐ ĐIỆN THOẠI
   */
  static async register(data: {
    fullName: string;
    email: string;
    password: string;
    phoneNumber?: string;
  }) {
    const { fullName, email, password, phoneNumber } = data;
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

    // Mã hóa số điện thoại trước khi lưu
    const encryptedPhone = phoneNumber
      ? EncryptionService.encrypt(phoneNumber)
      : null;

    const newUser = await prisma.users.create({
      data: {
        fullName,
        email: cleanEmail,
        password: hashedPassword,
        phoneNumber: encryptedPhone,
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
   * 3. Yêu cầu gửi OTP - GIỮ NGUYÊN
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
   * Đăng ký tài khoản kèm OTP - CÓ MÃ HÓA SỐ ĐIỆN THOẠI
   */
  static async completeRegister(data: {
    fullName: string;
    email: string;
    password: string;
    otp: string;
    phoneNumber?: string;
  }) {
    const { fullName, email, password, otp, phoneNumber } = data;
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

    const encryptedPhone = phoneNumber
      ? EncryptionService.encrypt(phoneNumber)
      : null;

    return await prisma.$transaction(async (tx) => {
      const newUser = await tx.users.create({
        data: {
          fullName,
          email: cleanEmail,
          password: hashedPassword,
          phoneNumber: encryptedPhone,
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

      const {
        password: _,
        currentChallenge: __,
        ...userWithoutPassword
      } = newUser;
      return userWithoutPassword;
    });
  }

  /**
   * Đặt lại mật khẩu qua OTP - GIỮ NGUYÊN
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
