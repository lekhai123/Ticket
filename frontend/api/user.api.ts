import axiosClient from "./axiosClient";
import type { ApiResponse, User } from "../types";

export const userApi = {
  // Lấy danh sách users (Admin)
  getUsers: async (params?: {
    search?: string;
    role?: string;
    status?: string;
  }): Promise<ApiResponse<User[]>> => {
    const res = await axiosClient.get<ApiResponse<User[]>>("/admin/users", {
      params,
    });
    return res.data;
  },

  // Cập nhật trạng thái ACTIVE / BANNED (Admin)
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

  // Cập nhật vai trò ADMIN / CUSTOMER (Admin)
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

  // 🎯 Cập nhật ảnh đại diện Avatar (User)
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
