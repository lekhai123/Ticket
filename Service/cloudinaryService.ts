// FILE: Service/cloudinaryService.ts
import { cloudinaryPrimary, cloudinaryBackup } from "../config/cloudinary";
import { Readable } from "stream";
import prisma from "../database/prismaClient";

export class CloudinaryService {
  /**
   * Helper upload stream tới một Cloudinary Instance cụ thể
   */
  private static uploadToInstance(
    cloudinaryInstance: typeof cloudinaryPrimary,
    fileBuffer: Buffer,
    userId: number,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinaryInstance.uploader.upload_stream(
        {
          folder: "nexus_ticket/avatars",
          public_id: `user_${userId}`,
          overwrite: true,
          transformation: [
            { width: 250, height: 250, crop: "fill", gravity: "face" },
            { quality: "auto", fetch_format: "auto" },
          ],
        },
        (error, result) => {
          if (error || !result) {
            return reject(error || new Error("Lỗi upload ảnh lên Cloudinary!"));
          }
          resolve(result.secure_url);
        },
      );

      Readable.from(fileBuffer).pipe(uploadStream);
    });
  }

  /**
   * Upload Avatar Stream với cơ chế Auto-Failover sang Cloudinary Backup
   */
  static async uploadAvatarStream(
    fileBuffer: Buffer,
    userId: number,
  ): Promise<string> {
    // 1. Thử Upload qua Cloudinary Primary
    try {
      return await this.uploadToInstance(cloudinaryPrimary, fileBuffer, userId);
    } catch (primaryError: any) {
      console.warn(
        `⚠️ [CLOUDINARY WARNING] Primary Cloud bị lỗi (${primaryError.message}). Tự động failover sang Backup Cloud...`,
      );
    }

    // 2. Fallback sang Cloudinary Backup
    try {
      return await this.uploadToInstance(cloudinaryBackup, fileBuffer, userId);
    } catch (backupError: any) {
      console.error(
        "❌ [CLOUDINARY CRITICAL] Cả 2 tài khoản Cloudinary đều thất bại!",
      );
      throw new Error(`Không thể upload avatar: ${backupError.message}`);
    }
  }

  static async updateAvatar(userId: number, fileBuffer: Buffer) {
    // 1. Upload ảnh lên Cloudinary (Tự chọn Cloud hợp lệ)
    const avatarUrl = await CloudinaryService.uploadAvatarStream(
      fileBuffer,
      userId,
    );

    // 2. Cập nhật link URL vào DB Supabase
    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: { avatarUrl },
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
