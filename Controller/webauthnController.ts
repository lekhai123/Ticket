import type { Request, Response } from "express";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import prisma from "../database/prismaClient";
import { AuthService } from "../Service/authService";

const rpName = "NexusTicket";

const rpID = process.env.WEBAUTHN_RP_ID || "localhost";
const origin = process.env.WEBAUTHN_ORIGIN || "http://localhost:5173";

export class WebAuthnController {
  /**
   * 1. Tạo Challenge để đăng ký Passkey (User phải đang đăng nhập)
   */
  static async generateRegistration(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const user = await prisma.users.findUnique({
        where: { id: userId },
        include: { credentials: true },
      });

      if (!user)
        return res.status(404).json({ message: "Người dùng không tồn tại" });

      const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userID: new TextEncoder().encode(userId.toString()),
        userName: user.email,
        excludeCredentials: user.credentials.map((cred) => ({
          id: cred.credentialID,
          type: "public-key",
          transports: cred.transports
            ? (cred.transports.split(",") as any)
            : undefined,
        })),
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred",
        },
      });

      // Lưu challenge vào DB để verify sau
      await prisma.users.update({
        where: { id: userId },
        data: { currentChallenge: options.challenge },
      });

      res.json(options);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * 2. Xác thực Đăng ký Passkey
   */
  static async verifyRegistration(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const { body } = req;
      const user = await prisma.users.findUnique({ where: { id: userId } });

      if (!user || !user.currentChallenge) {
        return res
          .status(400)
          .json({ message: "Không tìm thấy challenge hợp lệ" });
      }

      const verification = await verifyRegistrationResponse({
        response: body,
        expectedChallenge: user.currentChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });

      if (verification.verified && verification.registrationInfo) {
        const { credential } = verification.registrationInfo;
        const { id, publicKey, counter } = credential;

        await prisma.webAuthnCredential.create({
          data: {
            userId: user.id,
            credentialID: id,
            publicKey: Buffer.from(publicKey).toString("base64url"),
            counter,
            transports: body.response.transports?.join(",") || "",
          },
        });

        return res.json({
          success: true,
          message: "Đăng ký Vân tay/Khuôn mặt thành công!",
        });
      }
      return res
        .status(400)
        .json({ success: false, message: "Xác thực thất bại!" });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * 3. Tạo Challenge để đăng nhập bằng Passkey
   */
  static async generateAuthentication(req: Request, res: Response) {
    try {
      const { email } = req.body;
      const user = await prisma.users.findUnique({
        where: { email },
        include: { credentials: true },
      });

      if (!user || user.credentials.length === 0) {
        return res
          .status(404)
          .json({ message: "Tài khoản này chưa cài đặt Vân tay/Khuôn mặt!" });
      }

      const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: user.credentials.map((cred) => ({
          id: cred.credentialID,
          type: "public-key",
          transports: cred.transports
            ? (cred.transports.split(",") as any)
            : undefined,
        })),
        userVerification: "preferred",
      });

      await prisma.users.update({
        where: { id: user.id },
        data: { currentChallenge: options.challenge },
      });

      res.json(options);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * 4. Xác thực Đăng nhập Passkey & Cấp JWT
   */
  static async verifyAuthentication(req: Request, res: Response) {
    try {
      const { email, body } = req.body;
      const user = await prisma.users.findUnique({
        where: { email },
        include: { credentials: true, wallet: true },
      });

      if (!user || !user.currentChallenge) {
        return res.status(400).json({ message: "Yêu cầu không hợp lệ" });
      }

      const passkey = user.credentials.find((c) => c.credentialID === body.id);
      if (!passkey)
        return res.status(400).json({ message: "Passkey không hợp lệ!" });

      const verification = await verifyAuthenticationResponse({
        response: body,
        expectedChallenge: user.currentChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: passkey.credentialID,
          publicKey: Buffer.from(passkey.publicKey, "base64url"),
          counter: passkey.counter,
          transports: passkey.transports
            ? (passkey.transports.split(",") as any)
            : undefined,
        },
      });

      if (verification.verified) {
        // Cập nhật counter chống Replay Attack
        await prisma.webAuthnCredential.update({
          where: { id: passkey.id },
          data: { counter: verification.authenticationInfo.newCounter },
        });

        // Cấp phát JWT
        const tokens = AuthService.generateTokensForUser(user);
        const { password, currentChallenge, ...userWithoutPassword } = user;

        // Set Refresh Token vào HttpOnly Cookie
        res.cookie("refreshToken", tokens.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 7 * 24 * 60 * 60 * 1000,
          path: "/api/auth",
        });

        return res.json({
          success: true,
          accessToken: tokens.accessToken,
          user: userWithoutPassword,
        });
      }
      return res.status(400).json({ message: "Xác thực Passkey thất bại!" });
    } catch (error: any) {
      console.error("WebAuthn Login Error:", error);
      return res.status(400).json({ message: error.message });
    }
  }
}
