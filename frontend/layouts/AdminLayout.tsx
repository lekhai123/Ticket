import { Outlet, Navigate, Link, useLocation, useNavigate } from "react-router-dom";import { useAuthStore } from "../store/authStore";
import { useUiStore } from "../store/uiStore";
import {
  LayoutDashboard,
  Users,
  Gift,
  RotateCcw,
  Activity,
  ClipboardList,
  Menu,
  Bell,
  LogOut,
} from "lucide-react";
import { cn } from "../utils/cn";
import { authApi } from "../api/auth.api";

export default function AdminLayout() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const { isSidebarOpen, toggleSidebar } = useUiStore();
  const location = useLocation();
  const navigate = useNavigate();
  // Route Guard: Bắt buộc login và phải là ADMIN
  if (!isAuthenticated) return <Navigate to="/auth/login" replace />;
  if (user?.role !== "ADMIN") return <Navigate to="/403" replace />;

  const displayName = (user as any)?.fullName || user?.name || "Admin";
  const avatarUrl = user?.avatarUrl || (user as any)?.avatar;
  const initialLetter = displayName.charAt(0).toUpperCase();
  const handleLogout = async () => {
    try {
      await authApi.logout(); // 1. Gọi API xóa cookie/token trên Server
    } catch (error) {
      console.error("Lỗi khi đăng xuất:", error);
    } finally {
      logout(); // 2. Xóa store Zustand local
      navigate("/auth/login"); // 3. Chuyển về trang đăng nhập
    }
  };
  // 🎯 Danh sách Menu Điều Hướng Đầy Đủ
  const navItems = [
    {
      label: "Dashboard",
      path: "/admin/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "Quản lý Users",
      path: "/admin/users",
      icon: Users,
    },
    {
      label: "Tặng tiền (Mass Gift)",
      path: "/admin/mass-gift",
      icon: Gift,
    },
    {
      label: "Thu hồi (Revoke)",
      path: "/admin/revoke",
      icon: RotateCcw,
    },
    {
      label: "Lịch sử (Audit Log)",
      path: "/admin/audit-logs",
      icon: ClipboardList,
    },
    {
      label: "Sức khỏe (Health)",
      path: "/admin/health",
      icon: Activity,
    },
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      {/* Sidebar Điều Hướng */}
      <aside
        className={cn(
          "flex flex-col border-r border-zinc-200 bg-white transition-all duration-300 dark:border-zinc-800 dark:bg-zinc-950 z-20",
          isSidebarOpen ? "w-64" : "w-20",
        )}
      >
        {/* Logo Sidebar */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-zinc-200 dark:border-zinc-800">
          <Link
            to="/admin/dashboard"
            className="flex items-center gap-3 overflow-hidden"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold shrink-0">
              NX
            </div>
            {isSidebarOpen && (
              <span className="font-bold text-lg tracking-tight whitespace-nowrap">
                Nexus Admin
              </span>
            )}
          </Link>
        </div>

        {/* Dynamic Navigation Menu Items */}
        <nav className="flex-1 space-y-1.5 p-3 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            // Kiếm tra route active (bao gồm cả trường hợp đường dẫn con)
            const isActive = location.pathname.startsWith(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                title={!isSidebarOpen ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
                  !isSidebarOpen && "justify-center px-0",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {isSidebarOpen && (
                  <span className="truncate">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Nút Đăng xuất */}
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={handleLogout} // 👈 GỌI HÀM VỪA TẠO Ở ĐÂY
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 transition-colors",
              !isSidebarOpen && "justify-center px-0",
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {isSidebarOpen && <span>Đăng xuất</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-6 dark:border-zinc-800 dark:bg-zinc-950">
          <button
            onClick={toggleSidebar}
            className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-4">
            <button className="rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
              <Bell className="h-5 w-5" />
            </button>

            {/* Avatar Admin */}
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 overflow-hidden rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm border border-indigo-500 shadow-sm">
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
              <div className="hidden md:block text-left">
                <p className="text-sm font-semibold leading-none">
                  {displayName}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Administrator
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Pages */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-7xl">
            {/* TẤT CẢ TRANG CON SẼ RENDER VÀO ĐÂY */}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
