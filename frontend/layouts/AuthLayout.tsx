import { Outlet, Navigate } from "react-router-dom";
import { BusFront, ShieldCheck } from "lucide-react";
import { useAuthStore } from "../store/authStore";

export default function AuthLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen w-full bg-[#0D0D10] text-[#F5F5F7] font-sans selection:bg-[#8B5CF6]/30">
      {/* Cột trái: Form */}
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:w-[480px] border-r border-white/[0.08]">
        <div className="mx-auto w-full max-w-sm">
          <div className="flex items-center gap-3 mb-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8B5CF6] text-white shadow-[0_0_20px_rgba(139,92,246,0.3)]">
              <BusFront className="h-6 w-6" />
            </div>
            <span className="text-xl font-semibold tracking-tight">
              NexusTicket.
            </span>
          </div>

          <Outlet />
        </div>
      </div>

      {/* Cột phải: Graphic */}
      <div className="relative hidden w-full flex-1 lg:block overflow-hidden bg-[#15151B]">
        {/* Lớp nền tím mờ ảo tinh tế */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#8B5CF6]/10 via-transparent to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#8B5CF6]/10 blur-[120px] rounded-full" />

        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="max-w-md rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 backdrop-blur-md shadow-2xl">
            <ShieldCheck className="h-12 w-12 text-[#8B5CF6] mb-6" />
            <h2 className="text-3xl font-semibold mb-4 text-white tracking-tight">
              Enterprise Grade.
            </h2>
            <p className="text-[#92929F] leading-relaxed text-sm">
              Hệ thống lõi bảo mật đa tầng, tốc độ phản hồi tính bằng mili-giây.
              Sẵn sàng xử lý hàng ngàn giao dịch vé xe cùng lúc.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
