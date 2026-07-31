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

  // Bóc tách data an toàn từ Axios / Response
  const stats = (rawStats as any)?.data || rawStats;

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Overview Dashboard
          </h1>
          <p className="text-sm text-zinc-500">
            Dữ liệu Real-time tự động cập nhật mỗi phút.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 bg-emerald-100 px-3 py-1.5 rounded-full dark:bg-emerald-900/30 dark:text-emerald-400">
          <Activity className="h-4 w-4" /> Live
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Tổng Doanh Thu"
          value={formatCurrency(stats?.totalRevenue || 0)}
          icon={DollarSign}
        />
        <StatCard
          title="User Hoạt Động"
          value={(
            stats?.totalUsers ??
            stats?.activeUsers ??
            0
          ).toLocaleString()}
          icon={Users}
        />
        <StatCard
          title="Vé Hôm Nay"
          value={(
            stats?.totalTicketsSold ??
            stats?.todayTickets ??
            0
          ).toLocaleString()}
          icon={Ticket}
        />
        <StatCard
          title="Tổng Tiền Trong Ví"
          value={formatCurrency(
            stats?.totalSystemWalletBalance ?? stats?.totalWalletBalance ?? 0,
          )}
          icon={WalletCards}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
        {/* Biểu đồ Doanh Thu */}
        <div className="lg:col-span-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="text-lg font-semibold mb-6">Doanh thu 7 ngày qua</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={stats?.revenueChart || []}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#52525b"
                  opacity={0.2}
                />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(val) => `${val / 1000000}M`}
                />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Biểu đồ Tuyến đường */}
        <div className="lg:col-span-3 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="text-lg font-semibold mb-6">Top Tuyến Đường</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.topRoutes || []}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#52525b"
                  opacity={0.2}
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip cursor={{ fill: "#27272a", opacity: 0.1 }} />
                <Bar dataKey="tickets" fill="#a855f7" radius={[4, 4, 0, 0]} />
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
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-zinc-500">{title}</p>
        <div className="p-2 bg-zinc-100 rounded-lg dark:bg-zinc-900">
          <Icon className="h-5 w-5 text-zinc-700 dark:text-zinc-300" />
        </div>
      </div>
      <h3 className="text-2xl font-bold tracking-tight">{value}</h3>
    </div>
  );
}
