import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";
import axiosClient from "../api/axiosClient";
import { useAuthStore } from "../store/authStore";

export const usePasskey = () => {
  const setAuth = useAuthStore((state) => state.setAuth);

  // 1. Cài đặt Passkey (Yêu cầu đang đăng nhập)
  const registerPasskey = async () => {
    try {
      // Lấy options từ server
      const resp = await axiosClient.get("/auth/webauthn/register/generate");

      // Gọi API của trình duyệt (Hiện popup Vân tay/FaceID)
      const regResponse = await startRegistration(resp.data);

      // Gửi kết quả về server để lưu vào DB
      const verifyResp = await axiosClient.post(
        "/auth/webauthn/register/verify",
        regResponse,
      );

      return { success: true, message: verifyResp.data.message };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.message || "Thiết bị không hỗ trợ hoặc bạn đã hủy xác thực.",
      };
    }
  };

  // 2. Đăng nhập bằng Passkey (Dùng ở trang Login)
  const loginWithPasskey = async (email: string) => {
    try {
      // Lấy options từ server (cần email để tìm Passkey của user)
      const resp = await axiosClient.post("/auth/webauthn/login/generate", {
        email,
      });

      // Gọi API trình duyệt (Hiện popup Vân tay/FaceID)
      const authResponse = await startAuthentication(resp.data);

      // Gửi kết quả về server để lấy JWT
      const verifyResp = await axiosClient.post("/auth/webauthn/login/verify", {
        email,
        body: authResponse,
      });

      const { accessToken, user } = verifyResp.data;
      setAuth(user, accessToken); // Lưu JWT vào RAM
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Đăng nhập Passkey thất bại",
      };
    }
  };

  return { registerPasskey, loginWithPasskey };
};
