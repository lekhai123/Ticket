import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userApi } from "../api/user.api";
import { useAuthStore } from "../store/authStore";

export const useUser = () => {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  const updateAvatarMutation = useMutation({
    mutationFn: (file: File) => userApi.updateAvatar(file),
    onSuccess: (res) => {
      const updatedUser = res.data;
      if (updatedUser) setUser(updatedUser);
      queryClient.invalidateQueries({ queryKey: ["auth", "profile"] });
      alert("Cập nhật ảnh đại diện thành công!");
    },
    onError: (err: any) => alert(err?.message || "Tải ảnh đại diện thất bại!"),
  });

  return {
    updateAvatar: updateAvatarMutation.mutateAsync,
    isUploadingAvatar: updateAvatarMutation.isPending,
  };
};

// Cập nhật hàm useUsers nhận thêm tham số page
export const useUsers = (
  filters?: { search?: string; role?: string; status?: string },
  page: number = 1,
) => {
  const queryClient = useQueryClient();

  const usersQuery = useQuery({
    queryKey: ["users", filters, page], // Thêm page vào key
    queryFn: async () => {
      const res = await userApi.getUsers({ ...filters, page, limit: 10 });
      return res.data; // Trả về nguyên object { users, pagination }
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "ACTIVE" | "BANNED" }) =>
      userApi.updateStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: "ADMIN" | "CUSTOMER" }) =>
      userApi.updateRole(id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  return {
    usersData: usersQuery.data, // { users: [...], pagination: {...} }
    isLoading: usersQuery.isLoading,
    updateStatus: updateStatusMutation.mutateAsync,
    isUpdatingStatus: updateStatusMutation.isPending,
    updateRole: updateRoleMutation.mutateAsync,
    isUpdatingRole: updateRoleMutation.isPending,
  };
};
