import { walletApi } from "../api/wallet.api";
import type { TopUpPayload } from "../types";

export const walletService = {
  getFormattedBalance: async (userId: number) => {
    const response = await walletApi.getBalance(userId);
    const balance = response.data.balance;
    const isLocked = (response.data as any).isLocked; // Lấy trạng thái khóa

    return {
      raw: balance,
      isLocked: isLocked, // Phải có trường này
      formatted: new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
      }).format(balance),
    };
  },

  topUpWallet: async (userId: number, amount: number, batchId?: string) => {
    // Ép kiểu action chính xác theo TopUpPayload và chỉ truyền batchId khi có giá trị
    const payload: TopUpPayload = {
      amount,
      action: "TOP_UP",
      ...(batchId ? { batchId } : {}),
    };

    const response = await walletApi.topUp(userId, payload);
    return response.data;
  },
};
