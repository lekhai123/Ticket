import React, { useState, useEffect } from "react";
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
import { cn } from "../../utils/cn";

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
  const [loadingStep, setLoadingStep] = useState<"DB" | "AI" | null>(null);
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [userLogs, setUserLogs] = useState<AuditLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);
  const [unlockingUserId, setUnlockingUserId] = useState<number | null>(null);

  // Hiệu ứng chuyển trạng thái loading từ DB sang AI để người dùng đỡ sốt ruột
  useEffect(() => {
    let timer: any;
    if (loading) {
      setLoadingStep("DB");
      timer = setTimeout(() => {
        setLoadingStep("AI");
      }, 2000); // Sau 2s (giai đoạn DB thường nhanh), chuyển sang trạng thái chờ AI
    } else {
      setLoadingStep(null);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  const handleTriggerReconciliation = async () => {
    setLoading(true);
    setError(null);
    setReport(null); // Xóa kết quả cũ để hiển thị Skeleton
    try {
      const response = await axiosClient.post<{ data: ReconciliationReport }>(
        "/admin/reconciliation/trigger",
        {},
        { timeout: 60000 }, // Chờ tối đa 60s cho AI phân tích
      );
      setReport(response.data.data);
    } catch (err: any) {
      setError(err.message || "Không thể thực hiện đối soát tài chính!");
    } finally {
      setLoading(false);
    }
  };

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

  const handleUnlockWallet = async (userId: number) => {
    if (!window.confirm(`Xác nhận MỞ KHÓA VÍ thủ công cho User #${userId}?`))
      return;

    setUnlockingUserId(userId);
    try {
      const response = await axiosClient.patch(
        `/admin/wallets/${userId}/unlock`,
      );
      alert(
        response.data?.message ||
          `Đã mở khóa ví cho User #${userId} thành công!`,
      );
      handleTriggerReconciliation();
    } catch (err: any) {
      alert(err.message || `Không thể mở khóa ví cho User #${userId}!`);
    } finally {
      setUnlockingUserId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#F5F5F7] flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#8B5CF6]" /> Đối Soát Tài
            Chính (AIOps)
          </h1>
          <p className="text-sm text-[#92929F] mt-1">
            So sánh số dư thực tế với AuditLog (Tự động chạy 03:00 AM).
          </p>
        </div>
        <button
          onClick={handleTriggerReconciliation}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-all shadow-[0_0_15px_rgba(139,92,246,0.3)] min-w-[180px]"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          {loading
            ? loadingStep === "DB"
              ? "Đang quét dữ liệu..."
              : "AI đang phân tích..."
            : "Chạy Đối Soát Ngay"}
        </button>
      </div>

      {/* ERROR */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* SKELETON LOADING KHI CHƯA CÓ REPORT */}
      {loading && !report && (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 bg-[#15151B] rounded-2xl border border-white/[0.08]"
              ></div>
            ))}
          </div>
          <div className="h-48 bg-[#15151B] rounded-2xl border border-white/[0.08] flex items-center justify-center">
            <div className="text-[#92929F] flex flex-col items-center gap-3">
              <Bot className="w-8 h-8 text-[#8B5CF6] animate-bounce" />
              <p>Hệ thống đang đối soát và nhờ AI phân tích...</p>
            </div>
          </div>
        </div>
      )}

      {/* STATS CARDS */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-[#15151B] p-5 rounded-2xl border border-white/[0.08] flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#92929F]">
                Ví Đã Kiểm Tra
              </p>
              <h3 className="text-2xl font-semibold text-[#F5F5F7] mt-1">
                {report.totalWalletsChecked}{" "}
                <span className="text-xs font-normal text-[#92929F]">ví</span>
              </h3>
            </div>
            <div className="p-3 bg-[#0D0D10] text-[#8B5CF6] rounded-xl border border-white/[0.04]">
              <Wallet className="w-5 h-5" />
            </div>
          </div>

          <div
            className={cn(
              "p-5 rounded-2xl border flex items-center justify-between",
              report.mismatchCount > 0
                ? "bg-rose-500/5 border-rose-500/20"
                : "bg-emerald-500/5 border-emerald-500/20",
            )}
          >
            <div>
              <p
                className={cn(
                  "text-sm font-medium",
                  report.mismatchCount > 0
                    ? "text-rose-400"
                    : "text-emerald-400",
                )}
              >
                Tài Khoản Lệch
              </p>
              <h3
                className={cn(
                  "text-2xl font-semibold mt-1",
                  report.mismatchCount > 0
                    ? "text-rose-400"
                    : "text-emerald-400",
                )}
              >
                {report.mismatchCount}{" "}
                <span className="text-xs font-normal">tài khoản</span>
              </h3>
            </div>
            <div
              className={cn(
                "p-3 rounded-xl border",
                report.mismatchCount > 0
                  ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                  : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
              )}
            >
              {report.mismatchCount > 0 ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
            </div>
          </div>

          <div className="bg-[#15151B] p-5 rounded-2xl border border-white/[0.08] flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#92929F]">
                Thời Gian Xử Lý
              </p>
              <h3 className="text-2xl font-semibold text-[#F5F5F7] mt-1">
                {report.durationMs}{" "}
                <span className="text-xs font-normal text-[#92929F]">ms</span>
              </h3>
            </div>
            <div className="p-3 bg-[#0D0D10] text-purple-400 rounded-xl border border-white/[0.04]">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {/* AI SENTINEL CARD */}
      {report && (
        <>
          {loadingStep === "AI" && !report.aiAnalysis ? (
            // TRẠNG THÁI ĐANG CHỜ AI
            <div className="p-5 bg-gradient-to-r from-[#15151B] to-[#1a1a24] rounded-2xl border border-[#8B5CF6]/30 shadow-lg space-y-4">
              <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3">
                <div className="p-1.5 bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 rounded-lg">
                  <Bot className="w-5 h-5 text-[#8B5CF6] animate-pulse" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#F5F5F7]">
                    Gemini AIOps Sentinel
                  </h3>
                  <p className="text-[10px] text-[#8B5CF6]">
                    Đang phân tích dữ liệu (có thể mất 15-20s)...
                  </p>
                </div>
              </div>
              <div className="space-y-2 animate-pulse">
                <div className="h-4 bg-white/[0.04] rounded w-3/4"></div>
                <div className="h-4 bg-white/[0.04] rounded w-1/2"></div>
              </div>
            </div>
          ) : report?.aiAnalysis ? (
            // AI ĐÃ PHÂN TÍCH XONG
            <div className="p-5 bg-gradient-to-r from-[#15151B] to-[#1a1a24] rounded-2xl border border-[#8B5CF6]/30 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 rounded-lg">
                    <Bot className="w-5 h-5 text-[#8B5CF6]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#F5F5F7]">
                      Gemini AIOps Sentinel
                    </h3>
                    <p className="text-[10px] text-[#92929F]">
                      Chẩn đoán nguyên nhân gốc gây sự cố tài chính
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "px-2.5 py-1 text-xs font-bold rounded-full tracking-wide uppercase border",
                    ["CRITICAL", "HIGH"].includes(report.aiAnalysis.riskLevel)
                      ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                  )}
                >
                  Rủi ro: {report.aiAnalysis.riskLevel}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-[#0D0D10]/50 p-4 rounded-xl border border-white/[0.04]">
                  <p className="text-[#8B5CF6] font-medium mb-1">
                    🔍 Nguyên nhân gốc (Root Cause):
                  </p>
                  <p className="text-[#92929F] leading-relaxed">
                    {report.aiAnalysis.rootCauseAnalysis}
                  </p>
                </div>
                <div className="bg-[#0D0D10]/50 p-4 rounded-xl border border-white/[0.04]">
                  <p className="text-emerald-400 font-medium mb-1">
                    🛠️ Khuyến nghị (Recommended Action):
                  </p>
                  <p className="text-[#92929F] leading-relaxed">
                    {report.aiAnalysis.recommendedAction}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* MISMATCHES TABLE */}
      {report && report.mismatchedAccounts.length > 0 && (
        <div className="bg-[#15151B] rounded-2xl border border-rose-500/20 overflow-hidden">
          <div className="p-4 bg-rose-500/5 border-b border-rose-500/20 flex items-center justify-between">
            <h3 className="font-medium text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Danh Sách Ví Bất Thường
            </h3>
            <span className="text-xs font-medium px-2.5 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full">
              {report.mismatchedAccounts.length} Vi phạm (Đã khóa)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="border-b border-white/[0.04] text-[#92929F]">
                <tr>
                  <th className="p-4 font-medium">User ID</th>
                  <th className="p-4 font-medium">Thực Tế (DB)</th>
                  <th className="p-4 font-medium">Lý Thuyết (Log)</th>
                  <th className="p-4 font-medium">Chênh Lệch</th>
                  <th className="p-4 font-medium text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {report.mismatchedAccounts.map((item) => (
                  <tr
                    key={item.walletId}
                    className="hover:bg-rose-500/[0.02] transition-colors"
                  >
                    <td className="p-4 font-medium text-[#F5F5F7]">
                      #{item.userId}
                    </td>
                    <td className="p-4 text-[#92929F]">
                      {item.actualBalance.toLocaleString("vi-VN")} đ
                    </td>
                    <td className="p-4 text-[#92929F]">
                      {item.expectedBalance.toLocaleString("vi-VN")} đ
                    </td>
                    <td className="p-4 font-bold text-rose-400">
                      {item.difference > 0
                        ? `+${item.difference.toLocaleString("vi-VN")}`
                        : item.difference.toLocaleString("vi-VN")}{" "}
                      đ
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => handleInspectAuditLog(item.userId)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8B5CF6] bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 border border-[#8B5CF6]/20 px-3 py-1.5 rounded-lg transition"
                      >
                        Soi Log <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleUnlockWallet(item.userId)}
                        disabled={unlockingUserId === item.userId}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                      >
                        <LockOpen className="w-3.5 h-3.5" />{" "}
                        {unlockingUserId === item.userId
                          ? "Đang mở..."
                          : "Mở Khóa"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL AUDIT LOG */}
      {selectedUserId !== null && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#15151B] border border-white/[0.08] rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#8B5CF6]" />
                <h3 className="font-semibold text-[#F5F5F7]">
                  AuditLog - User #{selectedUserId}
                </h3>
              </div>
              <button
                onClick={() => setSelectedUserId(null)}
                className="p-1 text-[#92929F] hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
              {loadingLogs ? (
                <div className="py-12 text-center text-[#92929F] flex justify-center items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-[#8B5CF6]" />{" "}
                  Đang tải...
                </div>
              ) : userLogs.length === 0 ? (
                <div className="py-12 text-center text-[#92929F]">
                  ⚠️ Không tìm thấy log.
                  <br />
                  <span className="text-xs text-rose-400">
                    Đây có thể là nguyên nhân gây lệch tiền.
                  </span>
                </div>
              ) : (
                userLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 bg-[#0D0D10] rounded-xl border border-white/[0.04] text-xs space-y-2"
                  >
                    <div className="flex justify-between items-center font-medium">
                      <span className="px-2 py-0.5 bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/20 rounded-md">
                        {log.action}
                      </span>
                      <span className="text-[#92929F]">
                        {new Date(log.createdAt).toLocaleString("vi-VN")}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div>
                        <span className="text-[#92929F] block mb-1">
                          Old Data:
                        </span>
                        <pre className="bg-[#15151B] p-2 rounded text-rose-400 font-mono overflow-x-auto">
                          {JSON.stringify(log.oldData, null, 2) || "null"}
                        </pre>
                      </div>
                      <div>
                        <span className="text-[#92929F] block mb-1">
                          New Data:
                        </span>
                        <pre className="bg-[#15151B] p-2 rounded text-emerald-400 font-mono overflow-x-auto">
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
