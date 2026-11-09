import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { walletService } from "../services/wallet.service";

export const useWallet = (userId: number) => {
  const queryClient = useQueryClient();

  const balanceQuery = useQuery({
    queryKey: ["wallet", "balance", userId],
    queryFn: () => walletService.getFormattedBalance(userId),
    enabled: !!userId,
    staleTime: 0, // Luôn coi dữ liệu là cũ để fetch lại ngay lập tức
    refetchOnWindowFocus: true, //  Tự động fetch lại khi quay lại tab
  });

  const topUpMutation = useMutation({
    mutationFn: (amount: number) => walletService.topUpWallet(userId, amount),
    onSuccess: () => {
      //  Xóa cache ví để cập nhật số dư và lịch sử
      queryClient.invalidateQueries({
        queryKey: ["wallet"],
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
