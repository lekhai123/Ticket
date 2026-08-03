import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userApi } from "../api/user.api";
import { useAuthStore } from "../store/authStore";

/**
 * 🎯 1. HOOK DÀNH CHO CÁ NHÂN USER (Cập nhật Avatar, Profile,...)
 */
export const useUser = () => {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  const updateAvatarMutation = useMutation({
    mutationFn: (file: File) => userApi.updateAvatar(file),
    onSuccess: (res) => {
      // userApi.updateAvatar() trả về ApiResponse<User> -> res.data chứa User object
      const updatedUser = res.data;

      if (updatedUser) {
        setUser(updatedUser);
      }

      queryClient.invalidateQueries({ queryKey: ["auth", "profile"] });
      alert("Cập nhật ảnh đại diện thành công!");
    },
    onError: (err: any) => {
      alert(err?.message || "Tải ảnh đại diện thất bại!");
    },
  });

  return {
    updateAvatar: updateAvatarMutation.mutateAsync,
    isUploadingAvatar: updateAvatarMutation.isPending,
  };
};

/**
 * 🎯 2. HOOK DÀNH CHO ADMIN QUẢN TRỊ (Lấy danh sách, Khóa/Mở, Đổi Role,...)
 */
export const useUsers = (filters?: {
  search?: string;
  role?: string;
  status?: string;
}) => {
  const queryClient = useQueryClient();

  const usersQuery = useQuery({
    queryKey: ["users", filters],
    queryFn: async () => {
      // userApi.getUsers() trả về ApiResponse<User[]>
      const res = await userApi.getUsers(filters);
      return res.data || [];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "ACTIVE" | "BANNED" }) =>
      userApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: "ADMIN" | "CUSTOMER" }) =>
      userApi.updateRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  return {
    users: usersQuery.data || [],
    isLoading: usersQuery.isLoading,

    updateStatus: updateStatusMutation.mutateAsync,
    isUpdatingStatus: updateStatusMutation.isPending,

    updateRole: updateRoleMutation.mutateAsync,
    isUpdatingRole: updateRoleMutation.isPending,
  };
};
