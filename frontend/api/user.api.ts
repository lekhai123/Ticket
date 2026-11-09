import axiosClient from "./axiosClient";
import type { ApiResponse, User } from "../types";

export const userApi = {
  // Thêm page và limit vào params
  getUsers: async (params?: {
    search?: string;
    role?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<any> => {
    const res = await axiosClient.get<any>("/admin/users", {
      params,
    });
    return res.data;
  },

  updateStatus: async (
    userId: number,
    status: "ACTIVE" | "BANNED",
  ): Promise<ApiResponse<any>> => {
    const res = await axiosClient.patch<ApiResponse<any>>(
      `/admin/users/${userId}/status`,
      { status },
    );
    return res.data;
  },

  updateRole: async (
    userId: number,
    role: "ADMIN" | "CUSTOMER",
  ): Promise<ApiResponse<any>> => {
    const res = await axiosClient.patch<ApiResponse<any>>(
      `/admin/users/${userId}/role`,
      { role },
    );
    return res.data;
  },

  updateAvatar: async (file: File): Promise<ApiResponse<User>> => {
    const formData = new FormData();
    formData.append("avatar", file);

    const res = await axiosClient.patch<ApiResponse<User>>(
      "/users/avatar",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
    return res.data;
  },
};
