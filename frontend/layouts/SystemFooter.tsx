import React from "react";
import { useQuery } from "@tanstack/react-query";
import axiosClient from "../api/axiosClient";
import { Database, Server, Cloud, Bot } from "lucide-react";
import { cn } from "../utils/cn";

export default function SystemFooter() {
  // Gọi API mỗi 60 giây một lần (staleTime) để không spam server
  const { data, isLoading } = useQuery({
    queryKey: ["public-health"],
    queryFn: async () => {
      const res = await axiosClient.get("/trips/system-status");
      return res.data.data;
    },
    refetchInterval: 60000,
    staleTime: 60000,
  });

  const StatusDot = ({ isOnline, label, icon: Icon }: any) => (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-[#92929F]" />
      <span className="text-xs text-[#92929F]">{label}:</span>
      <div className="flex items-center gap-1.5">
        <div
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            isLoading
              ? "bg-zinc-500 animate-pulse"
              : isOnline
                ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]",
          )}
        />
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wider",
            isLoading
              ? "text-zinc-500"
              : isOnline
                ? "text-emerald-400"
                : "text-rose-400",
          )}
        >
          {isLoading ? "Checking" : isOnline ? "Online" : "Down"}
        </span>
      </div>
    </div>
  );

  return (
    <footer className="w-full border-t border-white/[0.08] bg-[#0D0D10] py-6 mt-auto">
      <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Logo & Copyright */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-[#F5F5F7]">
            NexusTicket.
          </span>
          <span className="text-xs text-[#92929F]">
            © 2027. All rights reserved.
          </span>
        </div>

        {/* System Status */}
        <div className="flex flex-wrap items-center justify-center gap-6">
          <StatusDot
            isOnline={data?.database}
            label="Database"
            icon={Database}
          />
          <StatusDot isOnline={data?.redis} label="Dual Redis" icon={Server} />
          <StatusDot isOnline={data?.cloudinary} label="Storage" icon={Cloud} />
          <StatusDot isOnline={data?.ai} label="AI Engine" icon={Bot} />
        </div>
      </div>
    </footer>
  );
}
