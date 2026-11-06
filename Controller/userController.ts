import type { Request, Response, NextFunction } from "express";
import { UserService } from "../Service/userService";

export class UserController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await UserService.registerUser(req.body);
      res.status(201).json({
        success: true,
        message: "Tạo tài khoản và khởi tạo ví thành công!",
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getUserProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = Number(req.params.id);
      const user = await UserService.getUserById(userId);
      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  static getMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message:
            "Phiên làm việc hết hạn hoặc không tìm thấy thông tin người dùng!",
        });
      }

      const userProfile = await UserService.getProfile(Number(userId));

      res.status(200).json({
        success: true,
        data: userProfile,
      });
    } catch (error) {
      next(error);
    }
  };

  static async updateAvatar(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;

      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: "Vui lòng chọn 1 file ảnh!" });
      }

      const updatedUser = await UserService.updateAvatar(
        Number(userId),
        req.file.buffer,
      );

      return res.status(200).json({
        success: true,
        message: "Cập nhật ảnh đại diện thành công!",
        data: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  }
}
