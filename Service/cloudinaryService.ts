// FILE: Service/cloudinaryService.ts
import cloudinary from "../config/cloudinary";
import { Readable } from "stream";
import prisma from "../database/prismaClient";

export class CloudinaryService {
  static uploadAvatarStream(
    fileBuffer: Buffer,
    userId: number,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "nexus_ticket/avatars",
          public_id: `user_${userId}`, // Đặt tên cố định theo ID người dùng (tự động ghi đè ảnh cũ)
          overwrite: true,
          transformation: [
            { width: 250, height: 250, crop: "fill", gravity: "face" }, // Tự nhận diện khuôn mặt & crop vuông 250x250
            { quality: "auto", fetch_format: "auto" }, // Tự nén ảnh sắc nét nhẹ nhất
          ],
        },
        (error, result) => {
          if (error || !result) {
            return reject(error || new Error("Lỗi upload ảnh lên Cloudinary!"));
          }
          resolve(result.secure_url); // Trả về link HTTPS công khai
        },
      );

      // Chuyển Buffer thành Readable Stream và pipe sang Cloudinary
      Readable.from(fileBuffer).pipe(uploadStream);
    });
  }
  static async updateAvatar(userId: number, fileBuffer: Buffer) {
    // 1. Upload ảnh lên Cloudinary
    const avatarUrl = await CloudinaryService.uploadAvatarStream(
      fileBuffer,
      userId,
    );

    // 2. Cập nhật link URL duy nhất vào DB Supabase
    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: { avatarUrl }, // Đảm bảo bảng Users trong schema.prisma có cột `avatarUrl String?`
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        avatarUrl: true,
      },
    });

    return updatedUser;
  }
}
