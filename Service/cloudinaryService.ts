import { v2 as cloudinary } from "cloudinary"; // Dùng singleton chung
import {
  cloudinaryPrimaryConfig,
  cloudinaryBackupConfig,
} from "../config/cloudinary";
import { Readable } from "stream";
import prisma from "../database/prismaClient";

export class CloudinaryService {
  /**
   * Helper: Upload lên 1 bucket cụ thể bằng cách tiêm (inject) config vào options
   * Việc này giúp tránh hoàn toàn lỗi ghi đè singleton của thư viện Cloudinary.
   */
  private static uploadToBucket(
    config: typeof cloudinaryPrimaryConfig,
    fileBuffer: Buffer,
    userId: number,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          ...config, // Bơm credentials (cloud_name, api_key...) trực tiếp vào đây
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
   * Upload Avatar Stream với cơ chế Retry (Primary) và Auto-Failover (Backup)
   */
  static async uploadAvatarStream(
    fileBuffer: Buffer,
    userId: number,
  ): Promise<string> {
    let lastPrimaryError: any;

    // 1. Thử Upload qua Cloudinary Primary (Thử tối đa 3 lần)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.uploadToBucket(
          cloudinaryPrimaryConfig,
          fileBuffer,
          userId,
        );
      } catch (e: any) {
        lastPrimaryError = e;
        console.warn(
          `[CLOUDINARY] Primary lỗi lần ${attempt + 1}/3: ${e.message}`,
        );
        // Chờ 0.5s -> 1s -> 2s trước khi thử lại
        await new Promise((r) => setTimeout(r, 2 ** attempt * 500));
      }
    }

    // 2. Fallback sang Cloudinary Backup
    console.warn(
      `[CLOUDINARY WARNING] Primary sập hoàn toàn. Chuyển sang Backup...`,
    );
    try {
      return await this.uploadToBucket(
        cloudinaryBackupConfig,
        fileBuffer,
        userId,
      );
    } catch (backupError: any) {
      console.error(
        "[CLOUDINARY CRITICAL] Cả 2 tài khoản Cloudinary đều thất bại!",
      );
      throw new Error(
        `Không thể upload avatar: Primary=${lastPrimaryError?.message}, Backup=${backupError.message}`,
      );
    }
  }

  /**
   * Cập nhật Avatar vào DB và tự động dọn dẹp ảnh cũ trên Cloudinary
   */
  static async updateAvatar(userId: number, fileBuffer: Buffer) {
    // Lấy URL ảnh cũ trước khi cập nhật
    const oldUser = await prisma.users.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    // Upload ảnh mới (Có retry + failover)
    const newAvatarUrl = await this.uploadAvatarStream(fileBuffer, userId);

    // Lưu link mới vào DB
    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: { avatarUrl: newAvatarUrl },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        avatarUrl: true,
      },
    });

    // Xóa ảnh cũ khỏi Cloudinary để đỡ tốn dung lượng
    if (oldUser?.avatarUrl && oldUser.avatarUrl !== newAvatarUrl) {
      try {
        const match = oldUser.avatarUrl.match(/\/v\d+\/(.+)\.[a-z]+$/i);
        if (match && match[1]) {
          // Lưu lại config hiện tại
          const currentConfig = cloudinary.config();

          // Chuyển tạm sang config Primary để xóa cho đúng bucket
          cloudinary.config(cloudinaryPrimaryConfig);

          // Hàm destroy tự động dùng config global, không nhận config trong options
          await cloudinary.uploader.destroy(match[1]);

          // Khôi phục lại config cũ
          cloudinary.config(currentConfig);

          console.log(`[CLOUDINARY] Đã dọn dẹp ảnh cũ của user ${userId}`);
        }
      } catch (err: any) {
        // Chỉ log lỗi, không throw để tránh làm hỏng luồng update ảnh mới
        console.error("[CLOUDINARY] Không xóa được ảnh cũ:", err.message);
      }
    }

    return updatedUser;
  }
}
