import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userApi } from "../api/user.api";
import { useAuthStore } from "../store/authStore";

/**
 * 🎯 1. HOOK DÀNH CHO CÁ NHÂN USER (Cập nhật Avatar, Profile,...)
 */
export const useUser = () => {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  // Mutation Đổi Avatar
  const updateAvatarMutation = useMutation({
    mutationFn: (file: File) => userApi.updateAvatar(file),
    onSuccess: (res: any) => {
      // Bóc tách đúng thông tin user trả về từ API Cloudinary
      const updatedUser = res?.data || res;

      // Cập nhật ngay thông tin User mới (có avatarUrl) vào RAM (Zustand Store)
      if (updatedUser) {
        setUser(updatedUser);
      }

      // Làm tươi cache Profile
      queryClient.invalidateQueries({ queryKey: ["auth", "profile"] });
      alert("Cập nhật ảnh đại diện thành công!");
    },
    onError: (err: any) => {
      alert(
        err?.message ||
          err?.response?.data?.message ||
          "Tải ảnh đại diện thất bại!",
      );
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

  // Query Lấy danh sách Users
  const usersQuery = useQuery({
    queryKey: ["users", filters],
    queryFn: () =>
      userApi.getUsers(filters).then((res: any) => res.data || res),
  });

  // Mutation Cập nhật trạng thái (ACTIVE / BANNED)
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "ACTIVE" | "BANNED" }) =>
      userApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  // Mutation Cập nhật vai trò (ADMIN / CUSTOMER)
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
