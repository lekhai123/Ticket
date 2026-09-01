import React, { useState } from "react";
import axiosClient from "../../api/axiosClient";
import {
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Clock,
  Wallet,
  ArrowUpRight,
  X,
  FileText,
  LockOpen,
  Bot,
} from "lucide-react";

interface MismatchDetail {
  userId: number;
  walletId: number;
  expectedBalance: number;
  actualBalance: number;
  difference: number;
  status?: string;
}

interface AIAnalysis {
  riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  rootCauseAnalysis: string;
  recommendedAction: string;
  executiveSummary?: string;
}

interface ReconciliationReport {
  success: boolean;
  totalWalletsChecked: number;
  mismatchCount: number;
  mismatchedAccounts: MismatchDetail[];
  durationMs: number;
  aiAnalysis?: AIAnalysis;
}

interface AuditLogItem {
  id: string;
  requestId: string;
  action: string;
  resource: string;
  oldData: any;
  newData: any;
  createdAt: string;
}

export const FinancialReconciliation: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  // State quản lý Modal Soi AuditLog
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [userLogs, setUserLogs] = useState<AuditLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);

  // State quản lý nút unlock
  const [unlockingUserId, setUnlockingUserId] = useState<number | null>(null);

  // 1. Kích hoạt đối soát
  const handleTriggerReconciliation = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axiosClient.post<{ data: ReconciliationReport }>(
        "/admin/reconciliation/trigger",
      );
      setReport(response.data.data);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          "Không thể thực hiện đối soát tài chính!",
      );
    } finally {
      setLoading(false);
    }
  };

  // 2. Lấy AuditLog chi tiết của User bị lệch tiền
  const handleInspectAuditLog = async (userId: number) => {
    setSelectedUserId(userId);
    setLoadingLogs(true);
    try {
      const response = await axiosClient.get(`/admin/audit-logs`, {
        params: { userId },
      });

      const logsArray = response.data?.data?.logs || [];
      setUserLogs(logsArray);
    } catch (err: any) {
      console.error("Lỗi khi tải AuditLog:", err);
      setUserLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  // 3. Mở khóa ví thủ công cho User sau khi Admin xác nhận
  const handleUnlockWallet = async (userId: number) => {
    if (!window.confirm(`Xác nhận MỞ KHÓA VÍ thủ công cho User #${userId}?`)) {
      return;
    }

    setUnlockingUserId(userId);
    try {
      const response = await axiosClient.patch(
        `/admin/wallets/${userId}/unlock`,
      );
      alert(
        response.data?.message ||
          `Đã mở khóa ví cho User #${userId} thành công!`,
      );
      // Re-trigger lại đối soát để cập nhật trạng thái mới
      handleTriggerReconciliation();
    } catch (err: any) {
      alert(
        err.response?.data?.message ||
          `Không thể mở khóa ví cho User #${userId}!`,
      );
    } finally {
      setUnlockingUserId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-indigo-600" />
            Đối Soát Tài Chính Hệ Thống (AIOps)
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            So sánh số dư thực tế trong Ví với toàn bộ lịch sử biến động
            AuditLog (Tự động chạy 03:00 AM)
          </p>
        </div>

        <button
          onClick={handleTriggerReconciliation}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium rounded-xl shadow transition-all duration-200 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Đang đối soát..." : "Chạy Đối Soát Ngay"}
        </button>
      </div>

      {/* ERROR ALERT */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border-l-4 border-red-500 text-red-700 dark:text-red-400 rounded-r-md text-sm">
          {error}
        </div>
      )}

      {/* OVERVIEW STATS CARDS */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">
                Ví Đã Kiểm Tra
              </p>
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                {report.totalWalletsChecked}{" "}
                <span className="text-xs font-normal text-zinc-500">ví</span>
              </h3>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 dark:bg-blue-950/50 rounded-xl">
              <Wallet className="w-6 h-6" />
            </div>
          </div>

          <div
            className={`p-5 rounded-2xl border shadow-sm flex items-center justify-between ${
              report.mismatchCount > 0
                ? "bg-red-50/50 border-red-200 dark:bg-red-950/20 dark:border-red-900/40"
                : "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/40"
            }`}
          >
            <div>
              <p
                className={`text-sm font-medium ${
                  report.mismatchCount > 0 ? "text-red-600" : "text-emerald-600"
                }`}
              >
                Tài Khoản Lệch Tiền
              </p>
              <h3
                className={`text-2xl font-bold mt-1 ${
                  report.mismatchCount > 0
                    ? "text-red-700 dark:text-red-400"
                    : "text-emerald-700 dark:text-emerald-400"
                }`}
              >
                {report.mismatchCount}{" "}
                <span className="text-xs font-normal">tài khoản</span>
              </h3>
            </div>
            <div
              className={`p-3 rounded-xl ${
                report.mismatchCount > 0
                  ? "bg-red-100 text-red-600 dark:bg-red-900/50"
                  : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50"
              }`}
            >
              {report.mismatchCount > 0 ? (
                <AlertTriangle className="w-6 h-6" />
              ) : (
                <ShieldCheck className="w-6 h-6" />
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">
                Thời Gian Xử Lý
              </p>
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                {report.durationMs}{" "}
                <span className="text-xs font-normal text-zinc-500">ms</span>
              </h3>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 dark:bg-purple-950/50 rounded-xl">
              <Clock className="w-6 h-6" />
            </div>
          </div>
        </div>
      )}

      {/* GEMINI AIOPS SENTINEL CARD */}
      {report?.aiAnalysis && (
        <div className="p-5 bg-gradient-to-r from-zinc-900 via-indigo-950 to-zinc-900 text-white rounded-2xl border border-indigo-500/30 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-indigo-800/50 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-500/20 border border-indigo-400/30 rounded-lg">
                <Bot className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="font-bold text-base text-zinc-100">
                  Gemini AIOps Sentinel - Phân Tích Hành Vi & Cảnh Báo
                </h3>
                <p className="text-xs text-indigo-300/80">
                  Chẩn đoán tự động nguyên nhân gốc gây ra sự cố tài chính
                </p>
              </div>
            </div>
            <span
              className={`px-3 py-1 text-xs font-extrabold rounded-full tracking-wide uppercase ${
                report.aiAnalysis.riskLevel === "CRITICAL" ||
                report.aiAnalysis.riskLevel === "HIGH"
                  ? "bg-red-500/20 text-red-400 border border-red-500/40"
                  : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
              }`}
            >
              Rủi ro: {report.aiAnalysis.riskLevel}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="bg-zinc-900/60 p-3.5 rounded-xl border border-indigo-900/40 space-y-1">
              <p className="text-indigo-400 font-bold flex items-center gap-1.5">
                🔍 Nguyên nhân gốc (Root Cause):
              </p>
              <p className="text-zinc-300 leading-relaxed">
                {report.aiAnalysis.rootCauseAnalysis}
              </p>
            </div>
            <div className="bg-zinc-900/60 p-3.5 rounded-xl border border-indigo-900/40 space-y-1">
              <p className="text-emerald-400 font-bold flex items-center gap-1.5">
                🛠️ Khuyến nghị hành động (Recommended Action):
              </p>
              <p className="text-zinc-300 leading-relaxed">
                {report.aiAnalysis.recommendedAction}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TABLE MISMATCHES */}
      {report && report.mismatchedAccounts.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-red-200 dark:border-red-900/50 shadow-sm overflow-hidden">
          <div className="p-4 bg-red-50 dark:bg-red-950/30 border-b border-red-100 dark:border-red-900/30 flex items-center justify-between">
            <h3 className="font-bold text-red-800 dark:text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              Danh Sách Ví Bất Thường Số Dư
            </h3>
            <span className="text-xs font-semibold px-2.5 py-1 bg-red-200 dark:bg-red-900/60 text-red-800 dark:text-red-200 rounded-full">
              {report.mismatchedAccounts.length} Vi phạm (Đã Auto-Freeze)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">User ID</th>
                  <th className="py-3.5 px-4">Wallet ID</th>
                  <th className="py-3.5 px-4">Số Dư Thực Tế (DB)</th>
                  <th className="py-3.5 px-4">Số Dư Lý Thuyết (AuditLog)</th>
                  <th className="py-3.5 px-4">Chênh Lệch</th>
                  <th className="py-3.5 px-4 text-right">Thao Tác Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
                {report.mismatchedAccounts.map((item) => (
                  <tr
                    key={item.walletId}
                    className="hover:bg-red-50/30 dark:hover:bg-red-950/10 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-semibold text-zinc-900 dark:text-zinc-100">
                      #{item.userId}
                    </td>
                    <td className="py-3.5 px-4 text-zinc-500">
                      #{item.walletId}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-zinc-900 dark:text-zinc-100">
                      {item.actualBalance.toLocaleString("vi-VN")} đ
                    </td>
                    <td className="py-3.5 px-4 font-medium text-zinc-500">
                      {item.expectedBalance.toLocaleString("vi-VN")} đ
                    </td>
                    <td className="py-3.5 px-4 font-bold text-red-600 dark:text-red-400">
                      {item.difference > 0
                        ? `+${item.difference.toLocaleString("vi-VN")}`
                        : item.difference.toLocaleString("vi-VN")}{" "}
                      đ
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      {/* Nút Soi AuditLog */}
                      <button
                        onClick={() => handleInspectAuditLog(item.userId)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        Soi AuditLog
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>

                      {/* Nút Mở Khóa Ví */}
                      <button
                        onClick={() => handleUnlockWallet(item.userId)}
                        disabled={unlockingUserId === item.userId}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <LockOpen className="w-3.5 h-3.5" />
                        {unlockingUserId === item.userId
                          ? "Đang mở..."
                          : "Mở Khóa Ví"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL SOI AUDIT LOG CỦA MỘT VÍ */}
      {selectedUserId !== null && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl border border-zinc-200 dark:border-zinc-800">
            {/* Modal Header */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">
                  Lịch Sử AuditLog - User #{selectedUserId}
                </h3>
              </div>
              <button
                onClick={() => setSelectedUserId(null)}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-zinc-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {loadingLogs ? (
                <div className="py-12 text-center text-zinc-500 flex justify-center items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
                  Đang tải vết AuditLog...
                </div>
              ) : userLogs.length === 0 ? (
                <div className="py-12 text-center text-zinc-500">
                  ⚠️ Không tìm thấy bất kỳ bản ghi AuditLog nào của User này!
                  <br />
                  <span className="text-xs text-red-500">
                    👉 Đây chính là lý do gây lệch tiền (Số dư DB tồn tại nhưng
                    không có Log).
                  </span>
                </div>
              ) : (
                userLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700/50 text-xs space-y-1.5"
                  >
                    <div className="flex justify-between items-center font-semibold">
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 rounded-md">
                        {log.action}
                      </span>
                      <span className="text-zinc-400">
                        {new Date(log.createdAt).toLocaleString("vi-VN")}
                      </span>
                    </div>
                    <p className="text-zinc-500">
                      Request ID:{" "}
                      <code className="text-zinc-700 dark:text-zinc-300">
                        {log.requestId}
                      </code>
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-200 dark:border-zinc-700 font-mono">
                      <div>
                        <span className="text-zinc-400 block">
                          Dữ liệu Cũ (oldData):
                        </span>
                        <pre className="bg-zinc-100 dark:bg-zinc-900 p-1.5 rounded text-[11px] overflow-x-auto text-red-500">
                          {JSON.stringify(log.oldData, null, 2) || "null"}
                        </pre>
                      </div>
                      <div>
                        <span className="text-zinc-400 block">
                          Dữ liệu Mới (newData):
                        </span>
                        <pre className="bg-zinc-100 dark:bg-zinc-900 p-1.5 rounded text-[11px] overflow-x-auto text-emerald-500">
                          {JSON.stringify(log.newData, null, 2) || "null"}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
