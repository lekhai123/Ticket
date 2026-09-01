import React from "react";
import {
  Database,
  Server,
  HardDrive,
  Activity,
  Cpu,
  Sparkles,
  Clock,
  Cloud,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { useSystemHealth } from "../../hooks/useAdminStats";
import { cn } from "../../utils/cn";

export default function Health() {
  const { data: rawData, isLoading } = useSystemHealth();
  const healthData = (rawData as any)?.data || rawData;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="h-44 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
          <div className="h-44 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
          <div className="h-44 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  const server = healthData?.server || {};
  const database = healthData?.database || {};
  const redis = healthData?.redis || {};
  const cloudinary = healthData?.cloudinary || {};
  const gemini = healthData?.gemini || {};
  const memory = healthData?.memory || {};

  const parseMB = (val: string) => parseFloat(val?.replace("MB", "") || "0");
  const heapUsedMB = parseMB(memory.heapUsed);
  const heapTotalMB = parseMB(memory.heapTotal);
  const heapPercent =
    heapTotalMB > 0 ? Math.round((heapUsedMB / heapTotalMB) * 100) : 0;

  const formatUptime = (seconds: number) => {
    if (!seconds) return "0s";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h > 0 ? `${h}h ` : ""}${m > 0 ? `${m}m ` : ""}${s}s`;
  };

  return (
    <div className="space-y-6 pt-6 max-w-7xl mx-auto px-4">
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            System Health & HA Monitor
          </h1>
          <p className="text-sm text-zinc-500">
            Giám sát thời gian thực trạng thái Failover của Dual-Redis,
            Dual-Cloudinary và Multi-Key Gemini API.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 bg-emerald-100 px-3 py-1.5 rounded-full dark:bg-emerald-950/60 dark:text-emerald-400">
          <Activity className="h-3.5 w-3.5 animate-pulse" />
          Tất cả hệ thống đang sẵn sàng (High Availability)
        </div>
      </div>

      {/* GRID CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* CARD 1: NODE.JS SERVER */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-indigo-50 p-2.5 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                  <Server className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Node.js Express Server</h3>
                  <p className="text-[11px] text-zinc-500">
                    {server.nodeVersion || "v24.x"}
                  </p>
                </div>
              </div>
              <StatusBadge
                status={server.status === "UP" ? "HEALTHY" : "DOWN"}
              />
            </div>

            <div className="space-y-2 mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800/80 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-zinc-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Uptime
                </span>
                <span className="font-mono font-bold text-indigo-600">
                  {formatUptime(server.uptimeSeconds)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: POSTGRESQL DATABASE */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-emerald-50 p-2.5 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">PostgreSQL Database</h3>
                  <p className="text-[11px] text-zinc-500">
                    {database.provider || "Supabase Pool"}
                  </p>
                </div>
              </div>
              <StatusBadge status={database.status} />
            </div>

            <div className="space-y-2 mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800/80 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Độ trễ Ping</span>
                <span className="font-mono font-bold text-emerald-600">
                  {database.latencyMs || "N/A"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 3: DUAL REDIS CLUSTER */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-red-50 p-2.5 dark:bg-red-950/50 text-red-600 dark:text-red-400">
                <Cpu className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Dual Redis Cache</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 rounded-full">
                  Đang dùng: {redis.activeProvider || "PRIMARY"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800/80 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Primary (Upstash 1):</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-zinc-400">
                  {redis.primary?.latencyMs}
                </span>
                <StatusBadge status={redis.primary?.status} />
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Backup (Upstash 2):</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-zinc-400">
                  {redis.backup?.latencyMs}
                </span>
                <StatusBadge status={redis.backup?.status} />
              </div>
            </div>
          </div>
        </div>

        {/* CARD 4: DUAL CLOUDINARY STORAGE */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-sky-50 p-2.5 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400">
                <Cloud className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Dual Cloudinary</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 rounded-full">
                  Đang dùng: {cloudinary.activeProvider || "PRIMARY"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800/80 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Cloud 1 (Primary):</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-zinc-400">
                  {cloudinary.primary?.latencyMs}
                </span>
                <StatusBadge status={cloudinary.primary?.status} />
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Cloud 2 (Backup):</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-zinc-400">
                  {cloudinary.backup?.latencyMs}
                </span>
                <StatusBadge status={cloudinary.backup?.status} />
              </div>
            </div>
          </div>
        </div>

        {/* CARD 5: MULTI-KEY GEMINI AI */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-amber-50 p-2.5 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Gemini AI Engine</h3>
                <p className="text-[11px] text-zinc-500">
                  {gemini.model || "gemini-2.5-flash"}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800/80 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Primary Key:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-zinc-400">
                  {gemini.primaryKey?.latencyMs}
                </span>
                <StatusBadge status={gemini.primaryKey?.status} />
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Backup Key:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-zinc-400">
                  {gemini.backupKey?.latencyMs}
                </span>
                <StatusBadge status={gemini.backupKey?.status} />
              </div>
            </div>
          </div>
        </div>

        {/* CARD 6: RAM HEAP MEMORY */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-purple-50 p-2.5 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
                <HardDrive className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Bộ nhớ RAM Server</h3>
                <p className="text-[11px] text-zinc-500">Heap Usage</p>
              </div>
            </div>
            <StatusBadge status="HEALTHY" />
          </div>

          <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800/80 text-xs">
            <div className="flex justify-between font-medium">
              <span className="text-zinc-500">Used / Total</span>
              <span className="font-mono text-purple-600">
                {memory.heapUsed || "0 MB"} / {memory.heapTotal || "0 MB"}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(heapPercent, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isHealthy = status === "HEALTHY" || status === "HEALTHY";
  const isUnconfigured = status === "UNCONFIGURED";

  if (isUnconfigured) {
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-500 dark:bg-zinc-800">
        Off
      </span>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
        isHealthy
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
          : "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400",
      )}
    >
      {isHealthy ? (
        <>
          <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Operational
        </>
      ) : (
        <>
          <XCircle className="w-3 h-3 text-red-500" /> Down
        </>
      )}
    </div>
  );
}
