import prisma from "../database/prismaClient";
import bcrypt from "bcryptjs";
import { CloudinaryService } from "./cloudinaryService";

export class UserService {
  /**
   * Đăng ký tài khoản mới và TỰ ĐỘNG khởi tạo Ví (Balance = 0.00) trong 1 Transaction
   */
  static async registerUser(data: {
    email: string;
    password: string;
    fullName: string;
  }) {
    // 1. Kiểm tra Email đã tồn tại chưa
    const existingUser = await prisma.users.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      const error: any = new Error("Email này đã được đăng ký sử dụng!");
      error.statusCode = 400;
      throw error;
    }

    // 2. Mã hóa mật khẩu
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // 3. Thực thi Transaction: Tạo User + Tạo Ví
    return await prisma.$transaction(async (tx) => {
      const newUser = await tx.users.create({
        data: {
          email: data.email,
          password: hashedPassword,
          fullName: data.fullName,
          wallet: {
            create: {
              balance: 0.0,
            },
          },
        },
        include: {
          wallet: true, // Trả về kèm thông tin ví vừa khởi tạo
        },
      });

      // Loại bỏ trường password trước khi trả về Client
      const { password, ...userWithoutPassword } = newUser;
      return userWithoutPassword;
    });
  }

  /**
   * Lấy thông tin User theo ID (kèm thông tin Ví)
   */
  static async getUserById(userId: number) {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
        wallet: true,
      },
    });

    if (!user) {
      const error: any = new Error("Không tìm thấy người dùng!");
      error.statusCode = 404;
      throw error;
    }

    return user;
  }
  static async getProfile(userId: number) {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
        wallet: {
          select: {
            balance: true,
          },
        },
      },
    });

    if (!user) {
      const error: any = new Error("Không tìm thấy thông tin người dùng!");
      error.statusCode = 404;
      throw error;
    }

    return user;
  }
  static async updateAvatar(userId: number, fileBuffer: Buffer) {
    // 1. Gọi CloudinaryService đẩy ảnh và nhận link CDN
    const avatarUrl = await CloudinaryService.uploadAvatarStream(
      fileBuffer,
      userId,
    );

    // 2. Cập nhật URL vào DB Supabase qua Prisma
    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: { avatarUrl },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    return updatedUser;
  }
}
