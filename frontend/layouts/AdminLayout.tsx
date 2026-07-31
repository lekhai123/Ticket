import { Outlet, Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useUiStore } from "../store/uiStore";
import { Menu, Bell } from "lucide-react";
import { cn } from "../utils/cn";

export default function AdminLayout() {
  const { user, isAuthenticated } = useAuthStore();
  const { isSidebarOpen, toggleSidebar } = useUiStore();

  // Route Guard: Bắt buộc login và phải là ADMIN
  if (!isAuthenticated) return <Navigate to="/auth/login" replace />;
  if (user?.role !== "ADMIN") return <Navigate to="/403" replace />; // Trang cấm truy cập

  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      {/* Sidebar (Sẽ được tách thành component riêng ở phần sau) */}
      <aside
        className={cn(
          "flex flex-col border-r border-zinc-200 bg-white transition-all duration-300 dark:border-zinc-800 dark:bg-zinc-950",
          isSidebarOpen ? "w-64" : "w-20",
        )}
      >
        <div className="flex h-16 items-center justify-center border-b border-zinc-200 dark:border-zinc-800">
          <span className="font-bold">
            {isSidebarOpen ? "Nexus Admin" : "NX"}
          </span>
        </div>
        {/* Render Menu Items ở đây */}
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-6 dark:border-zinc-800 dark:bg-zinc-950">
          <button
            onClick={toggleSidebar}
            className="rounded-md p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-4">
            <button className="rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900">
              <Bell className="h-5 w-5" />
            </button>
            <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              {user?.name?.charAt(0) || "A"}
            </div>
          </div>
        </header>

        {/* Dynamic Pages */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
