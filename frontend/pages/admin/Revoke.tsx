import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, ShieldAlert } from "lucide-react";
import { adminApi } from "../../api/admin.api";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";

export default function Revoke() {
  const [batchId, setBatchId] = useState("");
  const queryClient = useQueryClient();

  const revokeMutation = useMutation({
    // SỬA: Chỉ truyền batchId, không truyền adminUserId
    mutationFn: (batchId: string) => adminApi.revokeBatch({ batchId }),
    onSuccess: (data) => {
      alert(`Đã thu hồi ${data.data.revokedCount} giao dịch!`);
      setBatchId("");
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
    onError: (err: any) => {
      alert(err.message || "Lỗi thu hồi.");
    },
  });

  return (
    <div className="max-w-xl mx-auto space-y-6 pt-10">
      <div className="text-center mb-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20 mb-4">
          <RotateCcw className="h-7 w-7 text-rose-400" />
        </div>
        <h1 className="text-xl font-semibold text-[#F5F5F7]">
          Thu hồi (Revoke)
        </h1>
        <p className="text-sm text-[#92929F] mt-1">
          Thu hồi khẩn cấp giao dịch hàng loạt.
        </p>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#15151B] p-6">
        <h3 className="text-sm font-medium border-b border-white/[0.08] pb-3 mb-4 flex items-center gap-2 text-[#F5F5F7]">
          <ShieldAlert className="h-4 w-4 text-amber-400" /> Nhập Batch ID cần
          thu hồi
        </h3>
        <div className="space-y-4">
          <Input
            value={batchId}
            onChange={(e) => setBatchId(e.target.value.toUpperCase())}
            placeholder="VD: NIGHT_CRON_BUG_2026"
            className="font-mono text-center tracking-widest uppercase bg-[#0D0D10] border-white/[0.08] text-[#F5F5F7]"
          />
          <Button
            className="w-full bg-rose-600 hover:bg-rose-700 text-white"
            disabled={!batchId}
            isLoading={revokeMutation.isPending}
            onClick={() => {
              if (
                confirm(
                  `THU HỒI toàn bộ đợt [${batchId}]? Hành động này sẽ trừ tiền User.`,
                )
              ) {
                revokeMutation.mutate(batchId);
              }
            }}
          >
            Tiến hành Thu hồi
          </Button>
        </div>
      </div>
    </div>
  );
}
