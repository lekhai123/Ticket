import {
  Outlet,
  Navigate,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useUiStore } from "../store/uiStore";
import {
  LayoutDashboard,
  Bus,
  Users,
  Gift,
  RotateCcw,
  Activity,
  ClipboardList,
  ShieldCheck,
  Menu,
  Bell,
  LogOut,
  Ticket,
} from "lucide-react";
import { cn } from "../utils/cn";
import { authApi } from "../api/auth.api";

export default function AdminLayout() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const { isSidebarOpen, toggleSidebar } = useUiStore();
  const location = useLocation();
  const navigate = useNavigate();

  if (!isAuthenticated) return <Navigate to="/auth/login" replace />;
  if (user?.role !== "ADMIN") return <Navigate to="/403" replace />;

  const displayName = user?.fullName || "Admin";
  const avatarUrl = user?.avatarUrl || (user as any)?.avatar;
  const initialLetter = displayName.charAt(0).toUpperCase();

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error("Lỗi khi đăng xuất:", error);
    } finally {
      logout();
      navigate("/auth/login");
    }
  };

  const navItems = [
    { label: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Quản lý Chuyến xe", path: "/admin/trips", icon: Bus },
    { label: "Quản lý Users", path: "/admin/users", icon: Users },
    { label: "Quản lý Vé", path: "/admin/tickets", icon: Ticket },
    { label: "Tặng tiền", path: "/admin/mass-gift", icon: Gift },
    { label: "Thu hồi", path: "/admin/revoke", icon: RotateCcw },
    {
      label: "Đối soát tài chính",
      path: "/admin/reconciliation",
      icon: ShieldCheck,
    },
    {
      label: "Lịch sử (Audit Log)",
      path: "/admin/audit-logs",
      icon: ClipboardList,
    },
    { label: "Sức khỏe Hệ thống", path: "/admin/health", icon: Activity },
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0D0D10] text-[#F5F5F7] font-sans selection:bg-[#8B5CF6]/30">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r border-white/[0.08] bg-[#15151B] transition-all duration-300 z-20",
          isSidebarOpen ? "w-64" : "w-20",
        )}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b border-white/[0.08]">
          <Link
            to="/admin/dashboard"
            className="flex items-center gap-3 overflow-hidden"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#8B5CF6] text-white font-bold shrink-0 shadow-[0_0_15px_rgba(139,92,246,0.3)]">
              N
            </div>
            {isSidebarOpen && (
              <span className="font-semibold text-lg tracking-tight whitespace-nowrap">
                NexusTicket
              </span>
            )}
          </Link>
        </div>

        <nav className="flex-1 space-y-1 p-3 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                title={!isSidebarOpen ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-[#8B5CF6]/15 text-[#8B5CF6]"
                    : "text-[#92929F] hover:bg-white/[0.04] hover:text-[#F5F5F7]",
                  !isSidebarOpen && "justify-center px-0",
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 shrink-0",
                    isActive && "text-[#8B5CF6]",
                  )}
                />
                {isSidebarOpen && (
                  <span className="truncate">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/[0.08]">
          <button
            onClick={handleLogout}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-400 hover:bg-rose-500/10 transition-colors",
              !isSidebarOpen && "justify-center px-0",
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {isSidebarOpen && <span>Đăng xuất</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-white/[0.08] bg-[#0D0D10]/80 backdrop-blur-md px-6 z-10">
          <button
            onClick={toggleSidebar}
            className="rounded-lg p-2 text-[#92929F] hover:bg-white/[0.04] hover:text-white transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-4">
            <button className="relative rounded-full p-2 text-[#92929F] hover:bg-white/[0.04] hover:text-white transition-colors">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#8B5CF6]" />
            </button>

            <div className="h-6 w-px bg-white/[0.08]" />

            <div className="flex items-center gap-3">
              <div className="hidden md:block text-right">
                <p className="text-sm font-medium leading-none text-[#F5F5F7]">
                  {displayName}
                </p>
                <p className="text-xs text-[#92929F] mt-1">Administrator</p>
              </div>
              <div className="h-9 w-9 overflow-hidden rounded-full bg-[#15151B] border border-white/[0.08] flex items-center justify-center text-white font-bold text-sm">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{initialLetter}</span>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
          <div className="mx-auto max-w-7xl animate-in fade-in duration-300">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
