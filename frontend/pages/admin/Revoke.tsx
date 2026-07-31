import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, ShieldAlert } from "lucide-react";
import { adminApi } from "../../api/admin.api";
import { useAuthStore } from "../../store/authStore";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";

export default function Revoke() {
  const [batchId, setBatchId] = useState("");
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const revokeMutation = useMutation({
    mutationFn: (batchId: string) =>
      adminApi.revokeBatch({ batchId, adminUserId: user!.id }),
    onSuccess: (data) => {
      alert(`Đã thu hồi thành công ${data.data.revokedCount} giao dịch!`);
      setBatchId("");
      // Cập nhật lại list Audit Logs
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
    onError: (err: any) => {
      alert(
        err.message ||
          "Lỗi khi thu hồi. Có thể giao dịch đã bị thu hồi trước đó.",
      );
    },
  });

  const handleRevoke = () => {
    if (!batchId) return;
    if (
      confirm(
        `⚠️ Bạn có chắc chắn muốn THU HỒI toàn bộ tiền/vé của đợt phát [${batchId}] không? Hành động này sẽ trừ tiền User.`,
      )
    ) {
      revokeMutation.mutate(batchId);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pt-10">
      <div className="text-center mb-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
          <RotateCcw className="h-8 w-8 text-red-600 dark:text-red-500" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Revoke Center</h1>
        <p className="text-zinc-500 mt-2">
          Công cụ thu hồi khẩn cấp giao dịch hàng loạt thông qua Database
          Transaction.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="text-lg font-semibold border-b border-zinc-100 pb-4 mb-4 flex items-center gap-2 dark:border-zinc-800">
          <ShieldAlert className="h-5 w-5 text-amber-500" /> Nhập mã Batch ID
          cần thu hồi
        </h3>

        <div className="space-y-4">
          <Input
            value={batchId}
            onChange={(e) => setBatchId(e.target.value.toUpperCase())}
            placeholder="VD: NIGHT_CRON_BUG_2026"
            className="font-mono text-center text-lg uppercase"
          />
          <Button
            variant="destructive"
            className="w-full h-12 text-base font-bold"
            disabled={!batchId}
            isLoading={revokeMutation.isPending}
            onClick={handleRevoke}
          >
            Tiến hành Thu hồi Giao dịch (Rollback)
          </Button>
        </div>
      </div>
    </div>
  );
}
