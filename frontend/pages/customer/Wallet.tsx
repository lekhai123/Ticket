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

export default function Wallet() {
  const user = useAuthStore((state) => state.user);
  const { balance, isLoadingBalance, topUp, isToppingUp } = useWallet(
    user?.id || 0,
  );

  const [topUpAmount, setTopUpAmount] = useState("");

  // Fetch danh sách AuditLog / Lịch sử ví
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

  // 🛠️ Helper 1: Bóc tách số tiền chính xác theo từng loại Action/AuditLog
  const getAmount = (tx: any) => {
    const { action, newData } = tx;

    if (tx.amount !== undefined && tx.amount !== null) {
      return Number(tx.amount);
    }

    if (!newData) return 0;

    // Nếu có trường amount tường minh trong newData (như log thu hồi lưu amount âm)
    if (newData.amount !== undefined && newData.amount !== null) {
      return Number(newData.amount);
    }

    if (action === "MASS_GIFT_RECEIVED" || action === "MASS_GIFT_WALLET") {
      return Number(newData.amountAdded || newData.giftAmount || 0);
    }

    if (
      action === "MASS_GIFT_REVOKED" ||
      action === "REVOKE_MASS_GIFT" ||
      action === "REVOKE_BATCH"
    ) {
      return -Math.abs(Number(newData.amount || 0));
    }

    if (
      action === "CANCEL_TICKET_REFUND" ||
      action === "REFUND_TICKET_PAYMENT"
    ) {
      return Number(newData.amount || newData.refundAmount || 0);
    }

    return Number(
      newData.amount ??
        newData.amountAdded ??
        newData.giftAmount ??
        newData.refundAmount ??
        0,
    );
  };

  // 🛠️ Helper 2: Bóc tách mô tả thân thiện
  const getDescription = (tx: any) => {
    const { action, newData, isRevoked } = tx;

    if (newData?.description) return newData.description;
    if (tx.description) return tx.description;

    switch (action) {
      case "MASS_GIFT_RECEIVED":
      case "MASS_GIFT_WALLET": {
        const reason = newData?.reason ? ` (${newData.reason})` : "";
        return isRevoked
          ? `Nhận thưởng từ hệ thống${reason} [Đã thu hồi]`
          : `Nhận thưởng từ hệ thống${reason}`;
      }
      case "MASS_GIFT_REVOKED":
      case "REVOKE_MASS_GIFT":
      case "REVOKE_BATCH":
        return newData?.description || "Bị thu hồi tiền thưởng từ hệ thống";
      case "CANCEL_TICKET_REFUND":
      case "REFUND_TICKET_PAYMENT":
        return "Hoàn tiền mua vé xe";
      case "BOOK_TICKET_PAYMENT":
        return "Thanh toán mua vé xe";
      case "TOP_UP":
        return "Nạp tiền vào ví";
      default:
        return action ? action.replace(/_/g, " ") : "Giao dịch ví";
    }
  };

  // 🛠️ Helper 3: Xác định giao dịch Cộng tiền (+) hay Trừ tiền (-)
  const getIsPositive = (tx: any, amountVal: number) => {
    if (tx.isRevoked) return false;

    // Nếu amountVal trong DB lưu sẵn số âm (vd: log thu hồi tiền) -> Chắc chắn là trừ tiền (-)
    if (amountVal < 0) return false;

    const positiveActions = [
      "TOP_UP",
      "CANCEL_TICKET_REFUND",
      "REFUND_TICKET_PAYMENT",
      "SYSTEM_GIFT_BALANCE",
      "MASS_GIFT_RECEIVED",
      "MASS_GIFT_WALLET",
    ];

    if (positiveActions.includes(tx.action)) return true;
    return amountVal > 0;
  };

  if (!user) return null;

  const displayBalance =
    typeof balance === "object"
      ? (balance as any)?.formatted
      : formatCurrency(Number(balance || 0));

  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-8 tracking-tight">Ví điện tử</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Panel Ví */}
        <div className="lg:col-span-1 space-y-6">
          <div className="relative h-48 w-full overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-800 to-black p-6 text-white shadow-2xl">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-medium tracking-wider opacity-80 uppercase">
                  {(user as any).fullName || (user as any).name}
                </span>
                <WalletIcon className="h-6 w-6 opacity-80" />
              </div>
              <div>
                <p className="text-sm font-medium opacity-70 mb-1">
                  Số dư khả dụng
                </p>
                {isLoadingBalance ? (
                  <div className="h-10 w-32 bg-white/20 animate-pulse rounded-lg" />
                ) : (
                  <p className="text-4xl font-bold tracking-tight">
                    {displayBalance}
                  </p>
                )}
              </div>
            </div>
          </div>

          <form
            onSubmit={handleTopUp}
            className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <h3 className="font-semibold mb-4">Nạp tiền nhanh</h3>
            <Input
              type="number"
              placeholder="Nhập số tiền (VNĐ)..."
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              className="mb-4"
            />
            <Button type="submit" className="w-full" isLoading={isToppingUp}>
              Xác nhận nạp
            </Button>
          </form>
        </div>

        {/* Panel Lịch sử */}
        <div className="lg:col-span-2 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-xl font-semibold mb-6">Lịch sử giao dịch</h2>

          <div className="space-y-4">
            {isTxLoading && (
              <div className="flex justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
              </div>
            )}

            {!isTxLoading && transactionList.length === 0 && (
              <p className="text-center text-zinc-500 py-10">
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
                  className={`flex items-center justify-between rounded-2xl p-4 transition border border-transparent hover:border-zinc-100 dark:hover:border-zinc-800 ${
                    tx.isRevoked
                      ? "opacity-60 bg-zinc-50/50 dark:bg-zinc-900/20"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        tx.isRevoked
                          ? "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                          : isPositive
                            ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"
                            : "bg-red-100 text-red-600 dark:bg-red-900/30"
                      }`}
                    >
                      {isPositive ? (
                        <ArrowDownToLine className="h-5 w-5" />
                      ) : (
                        <ArrowUpFromLine className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-900 dark:text-white">
                        {description}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {formatDate(tx.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Hiển thị số tiền: Nếu bị Revoke thì gạch ngang */}
                  <div
                    className={`font-bold ${
                      tx.isRevoked
                        ? "line-through text-zinc-400 dark:text-zinc-500"
                        : isPositive
                          ? "text-emerald-600"
                          : "text-red-600 dark:text-red-400"
                    }`}
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
