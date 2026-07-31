import React, { useState } from "react";
import { Search, ChevronDown, ChevronRight, FileJson } from "lucide-react";
import { useAuditLogs } from "../../hooks/useAudit";
import { Input } from "../../components/ui/Input";
import { formatDate } from "../../utils/format";

export default function AuditLog() {
  const [search, setSearch] = useState("");
  const { data: logs, isLoading } = useAuditLogs({ search }); // Gọi API thật
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-sm text-zinc-500">
          Truy vết mọi biến động dữ liệu và tài sản (Realtime).
        </p>
      </div>

      <div className="flex gap-4">
        <Input
          value={search}
          onChange={(e: any) => setSearch(e.target?.value ?? e)}
          placeholder="Tìm theo Request ID, Batch ID..."
          className="max-w-md bg-white dark:bg-zinc-950"
        />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900/50">
            <tr>
              <th className="w-10 px-4 py-3"></th>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">User ID</th>
              <th className="px-4 py-3">Batch/Request ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="text-center py-10">
                  Đang tải dữ liệu...
                </td>
              </tr>
            ) : (
              logs?.map((log) => (
                <React.Fragment key={log.id}>
                  <tr
                    onClick={() =>
                      setExpandedRow(expandedRow === log.id ? null : log.id)
                    }
                    className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                  >
                    <td className="px-4 py-3">
                      {expandedRow === log.id ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono">{log.userId}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-amber-600 dark:text-amber-400">
                          {log.batchId || "-"}
                        </span>
                        <span className="text-xs text-zinc-400 font-mono">
                          {log.requestId}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {expandedRow === log.id && (
                    <tr>
                      <td
                        colSpan={5}
                        className="bg-zinc-50 px-8 py-4 dark:bg-zinc-900/20"
                      >
                        <div className="grid grid-cols-2 gap-6">
                          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                            <div className="mb-2 flex text-xs font-semibold text-zinc-500 uppercase">
                              <FileJson className="h-4 w-4 mr-2" /> Old Data
                            </div>
                            <pre className="text-xs text-red-500 overflow-x-auto font-mono">
                              {JSON.stringify(log.oldData, null, 2)}
                            </pre>
                          </div>
                          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                            <div className="mb-2 flex text-xs font-semibold text-zinc-500 uppercase">
                              <FileJson className="h-4 w-4 mr-2" /> New Data
                            </div>
                            <pre className="text-xs text-emerald-500 overflow-x-auto font-mono">
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
