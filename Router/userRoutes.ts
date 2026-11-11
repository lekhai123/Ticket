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

/*router.post(
  "/register",
  rateLimit(10, 60),
  validate(registerUserSchema),
  UserController.register,
);*/
router.get("/me", authenticateToken, UserController.getMe);
router.get(
  "/:id",
  rateLimit(200, 60),
  validate(getUserParamSchema),
  UserController.getUserProfile,
);

router.patch(
  "/avatar",
  authenticateToken,
  rateLimit(20, 60),
  uploadSingleImage,
  UserController.updateAvatar,
);

export default router;
