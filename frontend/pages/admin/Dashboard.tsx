import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  DollarSign,
  Users,
  Ticket,
  WalletCards,
  Activity,
  Loader2,
} from "lucide-react";
import { useAdminDashboard } from "../../hooks/useAdminStats";
import { formatCurrency } from "../../utils/format";

export default function Dashboard() {
  const { data: rawStats, isLoading } = useAdminDashboard();

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#8B5CF6]" />
      </div>
    );
  }

  const stats = (rawStats as any)?.data || rawStats;

  const formatYAxis = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return `${val}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#F5F5F7]">
            Tổng quan Hệ thống
          </h1>
          <p className="text-sm text-[#92929F] mt-1">
            Dữ liệu thời gian thực, tự động cập nhật mỗi phút.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
          <Activity className="h-3.5 w-3.5 animate-pulse" /> Live
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Tổng Doanh Thu"
          value={formatCurrency(stats?.totalRevenue || 0)}
          icon={DollarSign}
        />
        <StatCard
          title="Khách Hàng"
          value={(stats?.totalUsers ?? 0).toLocaleString()}
          icon={Users}
        />
        <StatCard
          title="Vé Đã Bán"
          value={(stats?.totalTicketsSold ?? 0).toLocaleString()}
          icon={Ticket}
        />
        <StatCard
          title="Tổng Tiền Trong Ví"
          value={formatCurrency(stats?.totalSystemWalletBalance ?? 0)}
          icon={WalletCards}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
        <div className="lg:col-span-4 rounded-2xl border border-white/[0.08] bg-[#15151B] p-6">
          <h3 className="text-base font-semibold text-[#F5F5F7] mb-6">
            Doanh thu 7 ngày qua
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={stats?.revenueChart || []}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="rgba(255,255,255,0.05)"
                />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#92929F" }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#92929F" }}
                  tickFormatter={formatYAxis}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#15151B",
                    borderColor: "rgba(255,255,255,0.08)",
                    borderRadius: "12px",
                    color: "#F5F5F7",
                  }}
                  itemStyle={{ color: "#8B5CF6" }}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#8B5CF6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-3 rounded-2xl border border-white/[0.08] bg-[#15151B] p-6">
          <h3 className="text-base font-semibold text-[#F5F5F7] mb-6">
            Top Tuyến Đường
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.topRoutes || []}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="rgba(255,255,255,0.05)"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#92929F" }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.02)" }}
                  contentStyle={{
                    backgroundColor: "#15151B",
                    borderColor: "rgba(255,255,255,0.08)",
                    borderRadius: "12px",
                    color: "#F5F5F7",
                  }}
                />
                <Bar dataKey="tickets" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon }: any) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#15151B] p-6 transition-all hover:border-white/[0.15]">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-[#92929F]">{title}</p>
        <div className="p-2 bg-white/[0.04] rounded-lg text-[#8B5CF6]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <h3 className="text-2xl font-semibold tracking-tight text-[#F5F5F7]">
        {value}
      </h3>
    </div>
  );
}
