import prisma from "../database/prismaClient";
import bcrypt from "bcryptjs";
import { CloudinaryService } from "./cloudinaryService";

export class UserService {
  static async registerUser(data: {
    email: string;
    password: string;
    fullName: string;
  }) {
    const cleanEmail = data.email.toLowerCase().trim();

    const existingUser = await prisma.users.findUnique({
      where: { email: cleanEmail },
    });

    if (existingUser) {
      const error: any = new Error("Email này đã được đăng ký sử dụng!");
      error.statusCode = 400;
      throw error;
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    return await prisma.$transaction(async (tx) => {
      const newUser = await tx.users.create({
        data: {
          email: cleanEmail,
          password: hashedPassword,
          fullName: data.fullName,
          role: "CUSTOMER", // Đảm bảo role mặc định
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

      // Loại bỏ trường password trước khi trả về Client
      const { password, ...userWithoutPassword } = newUser;
      return userWithoutPassword;
    });
  }

  // Hàm lấy profile của bất kỳ ai (Công khai)
  static async getUserById(userId: number) {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        createdAt: true,
        // BẢO MẬT: Tuyệt đối không trả về email, role, hay wallet ở đây
      },
    });

    if (!user) {
      const error: any = new Error("Không tìm thấy người dùng!");
      error.statusCode = 404;
      throw error;
    }

    return user;
  }

  // Hàm lấy profile của chính mình (Cần token)
  static async getProfile(userId: number) {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        avatarUrl: true, // Thêm avatarUrl để FE hiển thị
        createdAt: true,
        wallet: {
          select: {
            balance: true,
            isLocked: true,
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
    // Chuyển sang dùng hàm của CloudinaryService để tự động dọn ảnh cũ
    return await CloudinaryService.updateAvatar(userId, fileBuffer);
  }
}
