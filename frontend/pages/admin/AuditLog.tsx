import React, { useState } from "react";
import { ChevronDown, ChevronRight, FileJson } from "lucide-react";
import { useAuditLogs } from "../../hooks/useAudit";
import { Input } from "../../components/ui/Input";
import { formatDate } from "../../utils/format";
import { cn } from "../../utils/cn";

export default function AuditLog() {
  const [search, setSearch] = useState("");
  const { data: rawData, isLoading } = useAuditLogs({ search });
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const logsList =
    rawData?.logs ||
    rawData?.data?.logs ||
    (Array.isArray(rawData) ? rawData : []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[#F5F5F7]">
          Audit Logs
        </h1>
        <p className="text-sm text-[#92929F] mt-1">
          Truy vết mọi biến động dữ liệu.
        </p>
      </div>

      <div className="flex gap-4">
        <Input
          value={search}
          onChange={(e: any) => setSearch(e.target?.value ?? e)}
          placeholder="Tìm Request ID, Batch ID..."
          className="max-w-md bg-[#15151B] border-white/[0.08] text-[#F5F5F7]"
        />
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#15151B] overflow-hidden">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="border-b border-white/[0.08] text-[#92929F]">
            <tr>
              <th className="w-10 px-4 py-3 font-medium"></th>
              <th className="px-4 py-3 font-medium">Thời gian</th>
              <th className="px-4 py-3 font-medium">Hành động</th>
              <th className="px-4 py-3 font-medium">User ID</th>
              <th className="px-4 py-3 font-medium">Batch/Request</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-[#92929F]">
                  Đang tải...
                </td>
              </tr>
            ) : logsList.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-[#92929F]">
                  Không có lịch sử.
                </td>
              </tr>
            ) : (
              logsList.map((log: any) => (
                <React.Fragment key={log.id}>
                  <tr
                    onClick={() =>
                      setExpandedRow(expandedRow === log.id ? null : log.id)
                    }
                    className="cursor-pointer hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3 text-[#92929F]">
                      {expandedRow === log.id ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#F5F5F7]">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 px-2 py-0.5 text-xs font-medium text-[#8B5CF6]">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[#92929F]">
                      {log.userId}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-amber-400">
                          {log.batchId || "-"}
                        </span>
                        <span className="text-[10px] text-[#92929F] font-mono">
                          {log.requestId}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {expandedRow === log.id && (
                    <tr>
                      <td
                        colSpan={5}
                        className="bg-[#0D0D10] px-6 py-4 border-b border-white/[0.04]"
                      >
                        <div className="grid grid-cols-2 gap-4">
                          <div className="rounded-xl border border-white/[0.08] bg-[#15151B] p-3">
                            <div className="mb-2 flex text-xs font-medium text-[#92929F] uppercase tracking-wider">
                              <FileJson className="h-4 w-4 mr-2" /> Old Data
                            </div>
                            <pre className="text-xs text-rose-400 overflow-x-auto font-mono custom-scrollbar">
                              {JSON.stringify(log.oldData, null, 2)}
                            </pre>
                          </div>
                          <div className="rounded-xl border border-white/[0.08] bg-[#15151B] p-3">
                            <div className="mb-2 flex text-xs font-medium text-[#92929F] uppercase tracking-wider">
                              <FileJson className="h-4 w-4 mr-2" /> New Data
                            </div>
                            <pre className="text-xs text-emerald-400 overflow-x-auto font-mono custom-scrollbar">
                              {JSON.stringify(log.newData, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
