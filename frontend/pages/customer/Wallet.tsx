import { useState } from "react";
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

  if (!user) return null;

  const displayBalance =
    typeof balance === "object"
      ? balance?.formatted
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
                  {(user as any).fullName || user.name}
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
              // Bóc tách giá trị từ AuditLog hoặc Transaction record
              const amountVal = Number(
                tx.amount ??
                  tx.newData?.amount ??
                  tx.newData?.refundAmount ??
                  tx.newData?.giftAmount ??
                  0,
              );

              const isPositive =
                tx.action === "TOP_UP" ||
                tx.action === "CANCEL_TICKET_REFUND" ||
                tx.action === "SYSTEM_GIFT_BALANCE" ||
                amountVal > 0;

              const description =
                tx.description ||
                tx.newData?.description ||
                (tx.action && tx.action.replace(/_/g, " ")) ||
                "Giao dịch ví";

              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-2xl p-4 transition hover:bg-zinc-50 dark:hover:bg-zinc-900/50 border border-transparent hover:border-zinc-100 dark:hover:border-zinc-800"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        isPositive
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
                  <div
                    className={`font-bold ${
                      isPositive
                        ? "text-emerald-600"
                        : "text-zinc-900 dark:text-white"
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
