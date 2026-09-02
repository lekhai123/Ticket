import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authService } from "../services/auth.service";
import { useAuthStore } from "../store/authStore";

import type {
  CompleteRegisterPayload,
  ResetPasswordPayload,
} from "../api/auth.api";

import type { AuthResponse } from "../types/index";

// 🔒 CỜ TOÀN CỤC: Đảm bảo chỉ khởi tạo duy nhất 1 lần trong suốt vòng đời ứng dụng
let isAuthInitialized = false;
let authInitPromise: Promise<void> | null = null;

export const useAuth = () => {
  const queryClient = useQueryClient();

  const setAuth = useAuthStore((s) => s.setAuth);
  const logoutStore = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Nếu đã khởi tạo rồi thì không cần loading nữa
  const [isInitializing, setIsInitializing] = useState(!isAuthInitialized);
  const [otpCooldown, setOtpCooldown] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem("otp_cooldown_expire");
    if (!saved) return;

    const remain = Math.ceil((Number(saved) - Date.now()) / 1000);
    if (remain > 0) {
      setOtpCooldown(remain);
    } else {
      localStorage.removeItem("otp_cooldown_expire");
    }
  }, []);

  useEffect(() => {
    // Nếu đã chạy rồi thì bỏ qua hoàn toàn, không gọi lại khi chuyển trang
    if (isAuthInitialized) {
      setIsInitializing(false);
      return;
    }

    const init = async () => {
      try {
        // Gom request nếu nhiều component cùng gọi useAuth lần đầu
        if (!authInitPromise) {
          authInitPromise = (async () => {
            const res: AuthResponse = await authService.refreshToken();
            setAuth(res.user, res.accessToken);
          })();
        }
        await authInitPromise;
      } catch {
        logoutStore();
      } finally {
        isAuthInitialized = true;
        setIsInitializing(false);
      }
    };

    init();
  }, [logoutStore, setAuth]);

  useEffect(() => {
    if (otpCooldown <= 0) return;

    const timer = setTimeout(() => {
      setOtpCooldown((prev) => {
        if (prev <= 1) {
          localStorage.removeItem("otp_cooldown_expire");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [otpCooldown]);

  const startCooldown = (seconds = 60) => {
    localStorage.setItem(
      "otp_cooldown_expire",
      (Date.now() + seconds * 1000).toString(),
    );
    setOtpCooldown(seconds);
  };

  const loginMutation = useMutation({
    mutationFn: (payload: {
      email: string;
      password: string;
      rememberMe?: boolean;
    }) =>
      authService.login(payload.email, payload.password, payload.rememberMe),

    onSuccess: (res: AuthResponse) => {
      setAuth(res.user, res.accessToken);
    },
  });

  const otpMutation = useMutation({
    mutationFn: (payload: {
      email: string;
      type: "REGISTER" | "FORGOT_PASSWORD";
    }) => authService.requestOtp(payload.email, payload.type),

    onSuccess: () => startCooldown(),
  });

  const registerMutation = useMutation({
    mutationFn: (payload: CompleteRegisterPayload) =>
      authService.register(payload),
  });

  const resetMutation = useMutation({
    mutationFn: (payload: ResetPasswordPayload) =>
      authService.resetPassword(payload),
  });

  const logoutMutation = useMutation({
    mutationFn: authService.logout,

    onSettled: () => {
      localStorage.removeItem("otp_cooldown_expire");
      logoutStore();
      queryClient.clear();
    },
  });

  return {
    user,
    isAuthenticated,
    isInitializing,

    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,

    requestOtp: otpMutation.mutateAsync,
    isSendingOtp: otpMutation.isPending,

    register: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,

    resetPassword: resetMutation.mutateAsync,
    isResettingPassword: resetMutation.isPending,

    logout: logoutMutation.mutate,

    otpCooldown,
  };
};
