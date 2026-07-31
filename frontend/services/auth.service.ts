import { authApi } from "../api/auth.api";

export const authService = {
  login: (email: string, password: string, rememberMe = false) =>
    authApi.login({ email, password, rememberMe }),

  refreshToken: () => authApi.refreshToken(),

  logout: () => authApi.logout(),

  getProfile: () => authApi.getMe(),

  requestOtp: (email: string, type: "REGISTER" | "FORGOT_PASSWORD") =>
    authApi.requestOtp({ email, type }),

  register: authApi.register,

  resetPassword: authApi.resetPassword,
};
