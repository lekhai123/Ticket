import { Router } from "express";
import { UserController } from "../Controller/userController";
import { validate } from "../Middleware/validateMiddleware";
import { authenticateToken } from "../Middleware/authMiddleware";
import { uploadSingleImage } from "../Middleware/upload";
import { rateLimit } from "../Middleware/rateLimitMiddleware";
import {
  registerUserSchema,
  getUserParamSchema,
} from "../Validation/userValidation";

const router = Router();

router.post(
  "/register",
  rateLimit(3, 60),
  validate(registerUserSchema),
  UserController.register,
);
router.get("/me", authenticateToken, UserController.getMe);
router.get(
  "/:id",
  rateLimit(30, 60),
  validate(getUserParamSchema),
  UserController.getUserProfile,
);

// Upload Avatar (Chống spam upload file nặng)
router.patch(
  "/avatar",
  authenticateToken,
  rateLimit(5, 60), // Chỉ cho phép 5 lần đổi avatar / phút
  uploadSingleImage,
  UserController.updateAvatar,
);

export default router;
