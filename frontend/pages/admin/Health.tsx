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
} from "lucide-react";
import { useSystemHealth } from "../../hooks/useAdminStats";
import { cn } from "../../utils/cn";

export default function Health() {
  const { data: rawData, isLoading } = useSystemHealth();
  const healthData = (rawData as any)?.data || rawData;

  if (isLoading)
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-white/[0.04] rounded-lg" />
        <div className="grid grid-cols-3 gap-6">
          <div className="h-44 bg-[#15151B] rounded-2xl" />
          <div className="h-44 bg-[#15151B] rounded-2xl" />
          <div className="h-44 bg-[#15151B] rounded-2xl" />
        </div>
      </div>
    );

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
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#F5F5F7]">
            System Health
          </h1>
          <p className="text-sm text-[#92929F] mt-1">
            Giám sát trạng thái Failover của Dual-Redis, Dual-Cloudinary và
            Multi-Key Gemini.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
          <Activity className="h-3.5 w-3.5 animate-pulse" /> High Availability
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <HealthCard
          title="Node.js Server"
          subtitle={server.nodeVersion || "v20"}
          icon={Server}
          status={server.status === "UP" ? "HEALTHY" : "DOWN"}
        >
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#92929F] flex items-center gap-1">
              <Clock className="h-3 w-3" /> Uptime
            </span>
            <span className="font-mono text-[#8B5CF6]">
              {formatUptime(server.uptimeSeconds)}
            </span>
          </div>
        </HealthCard>

        <HealthCard
          title="PostgreSQL"
          subtitle={database.provider || "Supabase"}
          icon={Database}
          status={database.status}
        >
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#92929F]">Độ trễ Ping</span>
            <span className="font-mono text-emerald-400">
              {database.latencyMs || "N/A"}
            </span>
          </div>
        </HealthCard>

        <HealthCard
          title="Dual Redis Cache"
          subtitle={`Active: ${redis.activeProvider || "PRIMARY"}`}
          icon={Cpu}
          status="HEALTHY"
        >
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-[#92929F]">Primary:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[#92929F]">
                  {redis.primary?.latencyMs}
                </span>
                <StatusBadge status={redis.primary?.status} />
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#92929F]">Backup:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[#92929F]">
                  {redis.backup?.latencyMs}
                </span>
                <StatusBadge status={redis.backup?.status} />
              </div>
            </div>
          </div>
        </HealthCard>

        <HealthCard
          title="Dual Cloudinary"
          subtitle={`Active: ${cloudinary.activeProvider || "PRIMARY"}`}
          icon={Cloud}
          status="HEALTHY"
        >
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-[#92929F]">Primary:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[#92929F]">
                  {cloudinary.primary?.latencyMs}
                </span>
                <StatusBadge status={cloudinary.primary?.status} />
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#92929F]">Backup:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[#92929F]">
                  {cloudinary.backup?.latencyMs}
                </span>
                <StatusBadge status={cloudinary.backup?.status} />
              </div>
            </div>
          </div>
        </HealthCard>

        <HealthCard
          title="Gemini AI Engine"
          subtitle={gemini.model || "gemini-2.5-flash"}
          icon={Sparkles}
          status="HEALTHY"
        >
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-[#92929F]">Primary Key:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[#92929F]">
                  {gemini.primaryKey?.latencyMs}
                </span>
                <StatusBadge status={gemini.primaryKey?.status} />
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#92929F]">Backup Key:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[#92929F]">
                  {gemini.backupKey?.latencyMs}
                </span>
                <StatusBadge status={gemini.backupKey?.status} />
              </div>
            </div>
          </div>
        </HealthCard>

        <HealthCard
          title="RAM Server"
          subtitle="Heap Usage"
          icon={HardDrive}
          status="HEALTHY"
        >
          <div className="space-y-2 text-xs">
            <div className="flex justify-between font-medium">
              <span className="text-[#92929F]">Used / Total</span>
              <span className="font-mono text-purple-400">
                {memory.heapUsed || "0 MB"} / {memory.heapTotal || "0 MB"}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-[#0D0D10] overflow-hidden border border-white/[0.04]">
              <div
                className="h-full bg-[#8B5CF6] rounded-full"
                style={{ width: `${Math.min(heapPercent, 100)}%` }}
              />
            </div>
          </div>
        </HealthCard>
      </div>
    </div>
  );
}

function HealthCard({ title, subtitle, icon: Icon, status, children }: any) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#15151B] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-white/[0.04] p-2 text-[#8B5CF6]">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-medium text-sm text-[#F5F5F7]">{title}</h3>
            <p className="text-[10px] text-[#92929F]">{subtitle}</p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="mt-3 border-t border-white/[0.04] pt-3">{children}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "UNCONFIGURED")
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/[0.04] text-[#92929F]">
        Off
      </span>
    );
  const isHealthy = status === "HEALTHY";
  return (
    <div
      className={cn(
        "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border",
        isHealthy
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          : "bg-rose-500/10 text-rose-400 border-rose-500/20",
      )}
    >
      {isHealthy ? (
        <CheckCircle2 className="w-3 h-3" />
      ) : (
        <XCircle className="w-3 h-3" />
      )}
      {isHealthy ? "OK" : "Down"}
    </div>
  );
}
