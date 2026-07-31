import axiosClient from "./axiosClient";
import type { ApiResponse, User } from "../types";

export interface RequestOtpPayload {
  email: string;
  type: "REGISTER" | "FORGOT_PASSWORD";
}

export interface CompleteRegisterPayload {
  fullName: string;
  email: string;
  password: string;
  otp: string;
}

export interface ResetPasswordPayload {
  email: string;
  otp: string;
  newPassword: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export const authApi = {
  login: async (payload: {
    email: string;
    password: string;
    rememberMe: boolean;
  }): Promise<AuthResponse> => {
    const res = await axiosClient.post<ApiResponse<AuthResponse>>(
      "/auth/login",
      payload,
    );

    return res.data.data;
  },

  refreshToken: async (): Promise<AuthResponse> => {
    const res = await axiosClient.post<ApiResponse<AuthResponse>>(
      "/auth/refresh-token",
    );

    return res.data.data;
  },

  logout: async (): Promise<void> => {
    await axiosClient.post("/auth/logout");
  },

  getMe: async (): Promise<User> => {
    const res = await axiosClient.get<ApiResponse<User>>("/users/me");

    return res.data.data;
  },

  requestOtp: async (payload: RequestOtpPayload): Promise<void> => {
    await axiosClient.post<ApiResponse<null>>("/auth/request-otp", payload);
  },

  register: async (payload: CompleteRegisterPayload): Promise<User> => {
    const res = await axiosClient.post<ApiResponse<User>>(
      "/auth/register",
      payload,
    );

    return res.data.data;
  },

  resetPassword: async (payload: ResetPasswordPayload): Promise<void> => {
    await axiosClient.post<ApiResponse<null>>("/auth/reset-password", payload);
  },
};
