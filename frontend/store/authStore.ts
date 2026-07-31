import { create } from "zustand";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;

  // Actions
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  clearAuth: () => void; // Giữ lại alias này để không vỡ code cũ nếu có chỗ đang gọi
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,

  // 1. Cập nhật cả User và AccessToken khi Đăng nhập hoặc Khôi phục phiên
  setAuth: (user, accessToken) =>
    set({
      user,
      accessToken,
      isAuthenticated: true,
    }),

  // 2. 🎯 BỔ SUNG: Cập nhật AccessToken mới khi Silent Refresh thành công
  setAccessToken: (accessToken) =>
    set({
      accessToken,
      isAuthenticated: true,
    }),

  // 3. Cập nhật riêng thông tin User
  setUser: (user) => set({ user }),

  // 4. 🎯 BỔ SUNG: Xóa sạch State trên RAM khi Đăng xuất / Refresh Token thất bại
  logout: () =>
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    }),

  // Alias của logout để đảm bảo backward compatibility
  clearAuth: () =>
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    }),
}));
