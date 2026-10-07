import { Router } from "express";
import { UserController } from "../Controller/userController";
import { validate } from "../Middleware/validateMiddleware";
import { authenticateToken } from "../Middleware/authMiddleware";
import { uploadSingleImage } from "../Middleware/upload";
import {
  registerUserSchema,
  getUserParamSchema,
} from "../Validation/userValidation";

const router = Router();

router.post("/register", validate(registerUserSchema), UserController.register);

router.get("/me", authenticateToken, UserController.getMe);

router.get("/:id", validate(getUserParamSchema), UserController.getUserProfile);

router.patch(
  "/avatar",
  authenticateToken,
  uploadSingleImage,
  UserController.updateAvatar,
);

export default router;
