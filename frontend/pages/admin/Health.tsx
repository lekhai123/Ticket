import {
  Database,
  Server,
  HardDrive,
  ShieldCheck,
  Activity,
  Cpu,
  Sparkles,
  Clock,
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
    <div className="space-y-6 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Health</h1>
          <p className="text-sm text-zinc-500">
            Giám sát thời gian thực trạng thái máy chủ, cơ sở dữ liệu, bộ nhớ và
            các dịch vụ AI / Cache.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 bg-emerald-100 px-3 py-1.5 rounded-full dark:bg-emerald-900/30 dark:text-emerald-400">
          <Activity className="h-3.5 w-3.5 animate-pulse" /> Hệ thống bình
          thường
        </div>
      </div>

      {/* Grid 5 Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* CARD 1: SERVER NODE.JS */}
        <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-indigo-50 p-2 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                  <Server className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Node.js Server</h3>
                  <p className="text-[11px] text-zinc-500">
                    {server.nodeVersion || "v24.x"}
                  </p>
                </div>
              </div>
              <StatusBadge
                status={server.status === "UP" ? "operational" : "outage"}
              />
            </div>

            <div className="space-y-2.5 mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800/80">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Uptime
                </span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {formatUptime(server.uptimeSeconds)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">Trạng thái</span>
                <span className="font-medium text-emerald-600">Running</span>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: DATABASE POSTGRESQL */}
        <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-emerald-50 p-2 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Database</h3>
                  <p className="text-[11px] text-zinc-500">PostgreSQL</p>
                </div>
              </div>
              <StatusBadge
                status={
                  database.status === "HEALTHY" ? "operational" : "outage"
                }
              />
            </div>

            <div className="space-y-2.5 mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800/80">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">Độ trễ (Latency)</span>
                <span className="font-mono font-bold text-emerald-500">
                  {database.latencyMs || "0ms"}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">Kết nối DB</span>
                <span className="font-medium text-emerald-600">
                  Active Pool
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 3: REDIS CACHE */}
        <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-red-50 p-2 dark:bg-red-950/50 text-red-600 dark:text-red-400">
                  <Cpu className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Redis Cache</h3>
                  <p className="text-[11px] text-zinc-500">In-memory Store</p>
                </div>
              </div>
              <StatusBadge
                status={redis.status === "HEALTHY" ? "operational" : "outage"}
              />
            </div>

            <div className="space-y-2.5 mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800/80">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">Độ trễ (Latency)</span>
                <span className="font-mono font-bold text-red-500">
                  {redis.latencyMs || "12ms"}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">Trạng thái</span>
                <span className="font-medium text-emerald-600">Connected</span>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 4: GEMINI AI API */}
        <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-amber-50 p-2 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Gemini AI</h3>
                  <p className="text-[11px] text-zinc-500">
                    {gemini.model || "Flash 1.5"}
                  </p>
                </div>
              </div>
              <StatusBadge
                status={gemini.status === "HEALTHY" ? "operational" : "outage"}
              />
            </div>

            <div className="space-y-2.5 mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800/80">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">API Latency</span>
                <span className="font-mono font-bold text-amber-500">
                  {gemini.latencyMs || "45ms"}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">API Key</span>
                <span className="font-medium text-emerald-600">Configured</span>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 5: RAM USAGE */}
        <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-purple-50 p-2 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
                  <HardDrive className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Bộ nhớ RAM</h3>
                  <p className="text-[11px] text-zinc-500">Heap Memory</p>
                </div>
              </div>
              <StatusBadge status="operational" />
            </div>

            <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800/80">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-zinc-500">Used / Total</span>
                <span className="font-mono text-purple-600 dark:text-purple-400">
                  {memory.heapUsed || "0 MB"} / {memory.heapTotal || "0 MB"}
                </span>
              </div>

              <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(heapPercent, 100)}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-[11px] text-zinc-500 pt-1">
                <span>
                  RSS:{" "}
                  <strong className="text-zinc-700 dark:text-zinc-300 font-mono">
                    {memory.rss || "0 MB"}
                  </strong>
                </span>
                <span>{heapPercent}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: "operational" | "degraded" | "outage";
}) {
  const isOk = status === "operational";
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium",
        isOk
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
          : "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400",
      )}
    >
      <span className="relative flex h-2 w-2">
        {isOk && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full",
            isOk ? "bg-emerald-500" : "bg-red-500",
          )}
        />
      </span>
      {isOk ? "Operational" : "Down"}
    </div>
  );
}
