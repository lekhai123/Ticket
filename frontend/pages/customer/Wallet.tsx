import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Wallet as WalletIcon,
  ArrowDownToLine,
  ArrowUpFromLine,
  Loader2,
} from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { useWallet } from "../../hooks/useWallet";
import { walletApi } from "../../api/wallet.api";
import { formatCurrency, formatDate } from "../../utils/format";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { cn } from "../../utils/cn";

export default function Wallet() {
  const user = useAuthStore((state) => state.user);
  const { balance, isLoadingBalance, topUp, isToppingUp } = useWallet(
    user?.id || 0,
  );
  const [topUpAmount, setTopUpAmount] = useState("");

  const { data: txData, isLoading: isTxLoading } = useQuery({
    queryKey: ["wallet", "transactions", user?.id],
    queryFn: () =>
      walletApi.getTransactions(user!.id).then((res: any) => res.data),
    enabled: !!user?.id,
  });

  const transactionList = txData?.transactions || txData || [];

  const handleTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(topUpAmount);
    if (!amount || amount < 10000) return alert("Số tiền tối thiểu là 10,000đ");
    try {
      await topUp(amount);
      setTopUpAmount("");
    } catch (err: any) {
      alert(err.message || "Nạp tiền thất bại");
    }
  };

  const getAmount = (tx: any) => {
    const { action, newData } = tx;
    if (tx.amount !== undefined && tx.amount !== null) return Number(tx.amount);
    if (!newData) return 0;
    if (newData.amount !== undefined && newData.amount !== null)
      return Number(newData.amount);
    if (action === "MASS_GIFT_RECEIVED" || action === "MASS_GIFT_WALLET")
      return Number(newData.amountAdded || newData.giftAmount || 0);
    if (
      ["MASS_GIFT_REVOKED", "REVOKE_MASS_GIFT", "REVOKE_BATCH"].includes(action)
    )
      return -Math.abs(Number(newData.amount || 0));
    if (["CANCEL_TICKET_REFUND", "REFUND_TICKET_PAYMENT"].includes(action))
      return Number(newData.amount || newData.refundAmount || 0);
    return Number(
      newData.amount ??
        newData.amountAdded ??
        newData.giftAmount ??
        newData.refundAmount ??
        0,
    );
  };

  const getDescription = (tx: any) => {
    const { action, newData, isRevoked } = tx;
    if (newData?.description) return newData.description;
    if (tx.description) return tx.description;
    switch (action) {
      case "MASS_GIFT_RECEIVED":
      case "MASS_GIFT_WALLET":
        return isRevoked
          ? "Nhận thưởng [Đã thu hồi]"
          : "Nhận thưởng từ hệ thống";
      case "MASS_GIFT_REVOKED":
      case "REVOKE_MASS_GIFT":
      case "REVOKE_BATCH":
        return "Thu hồi tiền thưởng";
      case "CANCEL_TICKET_REFUND":
      case "REFUND_TICKET_PAYMENT":
        return "Hoàn tiền mua vé";
      case "BOOK_TICKET_PAYMENT":
        return "Thanh toán mua vé";
      case "TOP_UP":
        return "Nạp tiền vào ví";
      default:
        return action ? action.replace(/_/g, " ") : "Giao dịch ví";
    }
  };

  const getIsPositive = (tx: any, amountVal: number) => {
    if (tx.isRevoked) return false;
    if (amountVal < 0) return false;
    const positiveActions = [
      "TOP_UP",
      "CANCEL_TICKET_REFUND",
      "REFUND_TICKET_PAYMENT",
      "SYSTEM_GIFT_BALANCE",
      "MASS_GIFT_RECEIVED",
      "MASS_GIFT_WALLET",
    ];
    return positiveActions.includes(tx.action) || amountVal > 0;
  };

  if (!user) return null;
  const displayBalance =
    typeof balance === "object"
      ? (balance as any)?.formatted
      : formatCurrency(Number(balance || 0));

  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-semibold tracking-tight mb-8 text-[#F5F5F7]">
        Ví điện tử
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          {/* Thẻ số dư */}
          <div className="relative h-48 w-full overflow-hidden rounded-3xl bg-gradient-to-br from-[#15151B] to-[#0D0D10] border border-white/[0.08] p-6">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#8B5CF6]/20 blur-3xl" />
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div className="flex items-center justify-between">
                {/* SỬA DÒNG 128 TẠI ĐÂY: Bỏ user?.name */}
                <span className="text-sm font-medium text-[#92929F] uppercase tracking-wider">
                  {user?.fullName}
                </span>
                <WalletIcon className="h-6 w-6 text-[#8B5CF6]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#92929F] mb-1">
                  Số dư khả dụng
                </p>
                {isLoadingBalance ? (
                  <div className="h-10 w-32 bg-white/[0.04] animate-pulse rounded-lg" />
                ) : (
                  <p className="text-3xl font-semibold tracking-tight text-[#F5F5F7]">
                    {displayBalance}
                  </p>
                )}
              </div>
            </div>
          </div>

          <form
            onSubmit={handleTopUp}
            className="rounded-2xl border border-white/[0.08] bg-[#15151B] p-6"
          >
            <h3 className="font-medium text-[#F5F5F7] mb-4">Nạp tiền nhanh</h3>
            <Input
              type="number"
              placeholder="Nhập số tiền (VNĐ)..."
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              className="mb-4 bg-[#0D0D10] border-white/[0.08] text-[#F5F5F7]"
            />
            <Button
              type="submit"
              className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] text-white"
              isLoading={isToppingUp}
            >
              Xác nhận nạp
            </Button>
          </form>
        </div>

        {/* Lịch sử */}
        <div className="lg:col-span-2 rounded-3xl border border-white/[0.08] bg-[#15151B] p-6">
          <h2 className="text-lg font-medium mb-6 text-[#F5F5F7]">
            Lịch sử giao dịch
          </h2>
          <div className="space-y-3">
            {isTxLoading && (
              <div className="flex justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-[#8B5CF6]" />
              </div>
            )}
            {!isTxLoading && transactionList.length === 0 && (
              <p className="text-center text-[#92929F] py-10">
                Chưa có giao dịch nào.
              </p>
            )}
            {transactionList.map((tx: any) => {
              const amountVal = getAmount(tx);
              const description = getDescription(tx);
              const isPositive = getIsPositive(tx, amountVal);

              return (
                <div
                  key={tx.id}
                  className={cn(
                    "flex items-center justify-between rounded-2xl p-4 border border-transparent transition",
                    tx.isRevoked
                      ? "opacity-60 bg-[#0D0D10]/50"
                      : "hover:bg-white/[0.02] hover:border-white/[0.08]",
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full border",
                        tx.isRevoked
                          ? "bg-[#0D0D10] text-[#92929F] border-white/[0.04]"
                          : isPositive
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20",
                      )}
                    >
                      {isPositive ? (
                        <ArrowDownToLine className="h-4 w-4" />
                      ) : (
                        <ArrowUpFromLine className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#F5F5F7]">
                        {description}
                      </p>
                      <p className="text-xs text-[#92929F] mt-0.5">
                        {formatDate(tx.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "font-semibold",
                      tx.isRevoked
                        ? "line-through text-[#92929F]"
                        : isPositive
                          ? "text-emerald-400"
                          : "text-[#F5F5F7]",
                    )}
                  >
                    {isPositive ? "+" : "-"}
                    {formatCurrency(Math.abs(amountVal))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
