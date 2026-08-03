import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { walletService } from "../services/wallet.service";

export const useWallet = (userId: number) => {
  const queryClient = useQueryClient();

  const balanceQuery = useQuery({
    queryKey: ["wallet", "balance", userId],
    queryFn: () => walletService.getFormattedBalance(userId),
    enabled: !!userId,
  });

  const topUpMutation = useMutation({
    mutationFn: (amount: number) => walletService.topUpWallet(userId, amount),
    onSuccess: () => {
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
