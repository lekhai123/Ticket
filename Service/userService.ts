import prisma from "../database/prismaClient";
import bcrypt from "bcryptjs";
import { CloudinaryService } from "./cloudinaryService";

export class UserService {
  static async registerUser(data: {
    email: string;
    password: string;
    fullName: string;
  }) {
    const existingUser = await prisma.users.findUnique({
      where: { email: data.email },
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
          wallet: true,
        },
      });

      // Loại bỏ trường password trước khi trả về Client
      const { password, ...userWithoutPassword } = newUser;
      return userWithoutPassword;
    });
  }

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
    const avatarUrl = await CloudinaryService.uploadAvatarStream(
      fileBuffer,
      userId,
    );

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
