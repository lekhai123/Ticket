// FILE: api/user.api.ts
import axiosClient from "./axiosClient";
import type { ApiResponse, User } from "../types";

export const userApi = {
  // Lấy danh sách users (Admin)
  getUsers: (params?: {
    search?: string;
    role?: string;
    status?: string;
  }): Promise<ApiResponse<User[]>> => {
    return axiosClient.get("/admin/users", { params });
  },

  // Cập nhật trạng thái ACTIVE / BANNED (Admin)
  updateStatus: (
    userId: number,
    status: "ACTIVE" | "BANNED",
  ): Promise<ApiResponse<any>> => {
    return axiosClient.patch(`/admin/users/${userId}/status`, { status });
  },

  // Cập nhật vai trò ADMIN / CUSTOMER (Admin)
  updateRole: (
    userId: number,
    role: "ADMIN" | "CUSTOMER",
  ): Promise<ApiResponse<any>> => {
    return axiosClient.patch(`/admin/users/${userId}/role`, { role });
  },

  // 🎯 Cập nhật ảnh đại diện Avatar (User)
  updateAvatar: (file: File): Promise<ApiResponse<User>> => {
    const formData = new FormData();
    formData.append("avatar", file);

    return axiosClient.patch("/users/avatar", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },
};
