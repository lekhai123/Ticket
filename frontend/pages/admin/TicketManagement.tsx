import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../api/admin.api";
import {
  Search,
  Bot,
  AlertTriangle,
  ShieldCheck,
  XCircle,
  RefreshCcw,
  Loader2,
} from "lucide-react";
import { formatCurrency, formatDate } from "../../utils/format";
import { cn } from "../../utils/cn";

export default function TicketManagement() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState("");
  const [revokingTicketId, setRevokingTicketId] = useState<number | null>(null);

  const { data: response, isLoading } = useQuery({
    queryKey: ["admin-tickets", page, searchText],
    queryFn: () => adminApi.getTickets({ page, limit: 15, search: searchText }),
  });

  const tickets = response?.data || [];
  const totalPages = response?.meta?.totalPages || 1;

  const { data: alertResponse } = useQuery({
    queryKey: ["admin-ticket-alerts"],
    queryFn: () => adminApi.getAIAlerts(),
    refetchInterval: 60000,
  });

  const latestAlert = alertResponse?.data?.[0];

  const revokeMutation = useMutation({
    mutationFn: ({ ticketId, reason }: { ticketId: number; reason: string }) =>
      adminApi.revokeTicket(ticketId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["admin-ticket-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
      alert("Đã thu hồi vé và hoàn tiền thành công!");
    },
    onError: (err: any) => alert(err.message || "Lỗi khi thu hồi vé"),
    onSettled: () => setRevokingTicketId(null),
  });

  // ✅ MUTATION MỚI: Thu hồi tất cả vé lỗi
  const revokeAnomaliesMutation = useMutation({
    mutationFn: (reason: string) => adminApi.revokeAnomalies(reason),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["admin-ticket-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      alert(res.message);
    },
    onError: (err: any) => alert(err.message || "Lỗi khi thu hồi vé lỗi"),
  });

  const handleRevoke = (ticketId: number) => {
    const reason = prompt(
      "Nhập lý do thu hồi vé này (VD: Lỗi giá 0đ, Bug hệ thống...):",
    );
    if (reason && reason.trim().length > 0) {
      setRevokingTicketId(ticketId);
      revokeMutation.mutate({ ticketId, reason: reason.trim() });
    }
  };

  const handleRevokeAllAnomalies = () => {
    if (
      !confirm(
        "Hệ thống sẽ tự động quét và thu hồi TẤT CẢ vé bị lỗi giá (0đ/sai giá) trên toàn hệ thống. Bạn có chắc chắn?",
      )
    )
      return;

    const reason = prompt("Nhập lý do thu hồi (VD: Lỗi hệ thống gán giá 0đ):");
    if (reason && reason.trim().length > 0) {
      revokeAnomaliesMutation.mutate(reason.trim());
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#F5F5F7]">
            Quản lý Vé
          </h1>
          <p className="text-sm text-[#92929F] mt-1">
            Hệ thống AI tự động quét bất thường mỗi 15 phút.
          </p>
        </div>
        <div className="flex gap-3">
          {/* ✅ NÚT THU HỒI TẤT CẢ VÉ LỖI */}
          <button
            onClick={handleRevokeAllAnomalies}
            disabled={revokeAnomaliesMutation.isPending}
            className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 disabled:opacity-50"
          >
            {revokeAnomaliesMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            {revokeAnomaliesMutation.isPending
              ? "Đang dọn dẹp..."
              : "Thu hồi tất cả vé lỗi"}
          </button>

          <button
            onClick={() => queryClient.invalidateQueries()}
            className="bg-white/[0.04] hover:bg-white/[0.08] p-2 rounded-xl text-sm transition"
            title="Làm mới"
          >
            <RefreshCcw className="h-4 w-4 text-[#92929F]" />
          </button>
        </div>
      </div>

      {latestAlert && (
        <div className="p-4 rounded-2xl border bg-rose-500/10 border-rose-500/20">
          <h3 className="flex items-center gap-2 font-semibold mb-2 text-rose-400">
            <Bot className="h-5 w-5" />
            Báo cáo tự động từ AI ({formatDate(latestAlert.createdAt)})
          </h3>
          <p className="text-sm text-[#F5F5F7] mb-2">
            {(latestAlert.newData as any)?.aiAnalysis}
          </p>
          <p className="text-xs text-rose-300 font-medium">
            Vui lòng kiểm tra các vé có nền đỏ bên dưới và tiến hành thu hồi nếu
            cần thiết.
          </p>
        </div>
      )}

      <div className="relative max-w-md w-full">
        <input
          type="text"
          placeholder="Tìm theo Mã vé, Email, Tuyến đường, Batch ID..."
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value);
            setPage(1);
          }}
          className="w-full rounded-xl border border-white/[0.08] bg-[#15151B] px-4 py-2.5 text-sm text-[#F5F5F7] focus:border-[#8B5CF6] focus:outline-none pl-10"
        />
        <Search className="absolute left-3 top-3 h-4 w-4 text-[#92929F]" />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#15151B]">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="border-b border-white/[0.08] text-[#92929F]">
            <tr>
              <th className="p-4 font-medium">Mã Vé</th>
              <th className="p-4 font-medium">Khách hàng</th>
              <th className="p-4 font-medium">Chuyến xe</th>
              <th className="p-4 font-medium">Ngày đặt</th>
              <th className="p-4 font-medium">Thực trả</th>
              <th className="p-4 font-medium">Trạng thái</th>
              <th className="p-4 font-medium text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-[#92929F]">
                  Đang tải...
                </td>
              </tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-[#92929F]">
                  Không tìm thấy vé nào
                </td>
              </tr>
            ) : (
              tickets.map((ticket: any) => {
                const rowClass = ticket.isAnomaly
                  ? "bg-rose-500/5"
                  : "hover:bg-white/[0.02]";
                const isRevoking = revokingTicketId === ticket.id;
                return (
                  <tr
                    key={ticket.id}
                    className={cn("transition-colors", rowClass)}
                  >
                    <td className="p-4 font-mono text-xs text-[#F5F5F7]">
                      #{ticket.id}
                      <br />
                      <span className="text-[10px] text-[#92929F]">
                        {ticket.batchId}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-[#F5F5F7]">
                        {ticket.user?.fullName}
                      </p>
                      <p className="text-xs text-[#92929F]">
                        {ticket.user?.email}
                      </p>
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-[#F5F5F7]">
                        {ticket.trip?.route}
                      </p>
                      <p className="text-xs text-[#92929F]">
                        Ghế A{ticket.seatNumber}
                      </p>
                    </td>
                    <td className="p-4 text-xs text-[#92929F]">
                      {formatDate(ticket.createdAt)}
                    </td>
                    <td className="p-4">
                      <span
                        className={cn(
                          "font-semibold",
                          ticket.isAnomaly ? "text-rose-400" : "text-[#F5F5F7]",
                        )}
                      >
                        {formatCurrency(Number(ticket.paidAmount || 0))}
                      </span>
                      {ticket.isAnomaly && (
                        <p className="text-[10px] text-rose-400">
                          Giá gốc: {formatCurrency(ticket.trip?.price)}
                        </p>
                      )}
                    </td>
                    <td className="p-4">
                      {ticket.status === "CONFIRMED" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
                          <ShieldCheck className="h-3 w-3" />
                          Thành công
                        </span>
                      ) : ticket.status === "REVOKED_BY_ADMIN" ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-rose-500/10 text-rose-400 text-xs font-medium border border-rose-500/20">
                          Đã thu hồi
                        </span>
                      ) : (
                        <span className="text-xs text-[#92929F]">
                          {ticket.status}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {ticket.status === "CONFIRMED" && (
                        <button
                          onClick={() => handleRevoke(ticket.id)}
                          disabled={isRevoking}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200",
                            isRevoking
                              ? "bg-rose-500/20 border-rose-500/30 text-rose-300 cursor-wait"
                              : "bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/20 text-rose-400",
                          )}
                        >
                          {isRevoking ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Đang thu hồi...
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3.5 w-3.5" />
                              Thu hồi
                            </>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-6 mt-6 pt-6 border-t border-white/[0.08]">
          <button
            onClick={() => {
              setPage((prev) => prev - 1);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            disabled={page === 1}
            className="px-5 py-2.5 rounded-xl border border-white/[0.08] bg-[#15151B] text-sm font-medium text-[#F5F5F7] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/[0.04]"
          >
            Trang trước
          </button>
          <span className="text-sm text-[#92929F]">
            Trang <strong className="text-[#F5F5F7]">{page}</strong> /{" "}
            {totalPages}
          </span>
          <button
            onClick={() => {
              setPage((prev) => prev + 1);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            disabled={page >= totalPages}
            className="px-5 py-2.5 rounded-xl border border-white/[0.08] bg-[#15151B] text-sm font-medium text-[#F5F5F7] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/[0.04]"
          >
            Trang sau
          </button>
        </div>
      )}
    </div>
  );
}
