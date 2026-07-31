import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { walletService } from "../services/wallet.service";

export const useWallet = (userId: number) => {
  const queryClient = useQueryClient();

  // Tự động lấy số dư và cache lại
  const balanceQuery = useQuery({
    queryKey: ["wallet", "balance", userId],
    queryFn: () => walletService.getFormattedBalance(userId),
    enabled: !!userId,
  });

  // Action Nạp tiền
  const topUpMutation = useMutation({
    mutationFn: (amount: number) => walletService.topUpWallet(userId, amount),
    onSuccess: () => {
      // BẮT BUỘC: Khi nạp tiền thành công, ra lệnh cho React Query xóa cache
      // và tự động gọi lại API getBalance để UI cập nhật số tiền mới nhất.
      queryClient.invalidateQueries({
        queryKey: ["wallet", "balance", userId],
      });
      queryClient.invalidateQueries({
        queryKey: ["wallet", "transactions", userId],
      });
    },
  });

  return {
    balance: balanceQuery.data,
    isLoadingBalance: balanceQuery.isLoading,
    topUp: topUpMutation.mutateAsync,
    isToppingUp: topUpMutation.isPending,
  };
};
