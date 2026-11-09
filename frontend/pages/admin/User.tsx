import { useState } from "react";
import { Search, Ban, Unlock } from "lucide-react";
import { useUsers } from "../../hooks/useUser";
import { VipBadge } from "../../components/common/VipBadge";
import { Input } from "../../components/ui/Input";
import { formatCurrency } from "../../utils/format";
import { cn } from "../../utils/cn";

export default function Users() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Lấy dữ liệu và phân trang từ hook
  const { usersData, isLoading, updateStatus } = useUsers({ search }, page);

  const userList = usersData?.users || [];
  const totalPages = usersData?.pagination?.totalPages || 1;

  const handleToggleStatus = async (userId: number, currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "BANNED" : "ACTIVE";
    if (
      confirm(
        `Xác nhận ${newStatus === "BANNED" ? "KHÓA" : "MỞ KHÓA"} tài khoản này?`,
      )
    ) {
      try {
        await updateStatus({ id: userId, status: newStatus });
      } catch (err: any) {
        alert(err.message || "Thao tác thất bại");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#F5F5F7]">
            Quản lý Người Dùng
          </h1>
          <p className="text-sm text-[#92929F] mt-1">
            Giám sát và phân quyền hệ thống.
          </p>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative max-w-md w-full">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1); // Reset về trang 1 khi tìm kiếm
            }}
            placeholder="Tìm Tên, Email..."
            className="w-full bg-[#15151B] border-white/[0.08] text-[#F5F5F7] pl-10"
          />
          <Search className="absolute left-3 top-3 h-4 w-4 text-[#92929F]" />
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#15151B] overflow-hidden">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="border-b border-white/[0.08] text-[#92929F]">
            <tr>
              <th className="px-6 py-4 font-medium">User</th>
              <th className="px-6 py-4 font-medium">Role</th>
              <th className="px-6 py-4 font-medium">VIP</th>
              <th className="px-6 py-4 font-medium">Số dư</th>
              <th className="px-6 py-4 font-medium">Trạng thái</th>
              <th className="px-6 py-4 font-medium text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-[#92929F]">
                  Đang tải...
                </td>
              </tr>
            ) : userList.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-[#92929F]">
                  Không có dữ liệu.
                </td>
              </tr>
            ) : (
              userList.map((u: any) => {
                const userName = u.fullName || u.name || "Người dùng";
                return (
                  <tr
                    key={u.id}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0D0D10] border border-white/[0.08] text-[#8B5CF6] font-bold text-xs">
                          {userName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-[#F5F5F7]">
                            {userName}
                          </p>
                          <p className="text-xs text-[#92929F]">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "inline-flex rounded-md px-2 py-1 text-xs font-medium",
                          u.role === "ADMIN"
                            ? "bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/20"
                            : "bg-white/[0.04] text-[#92929F] border border-white/[0.08]",
                        )}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <VipBadge level={u.vipLevel ?? 0} />
                    </td>
                    <td className="px-6 py-4 font-medium text-[#F5F5F7]">
                      {formatCurrency(u.balance ?? u.wallet?.balance ?? 0)}
                    </td>
                    <td className="px-6 py-4">
                      {u.status === "ACTIVE" ? (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{" "}
                          Hoạt động
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-rose-400">
                          <div className="h-1.5 w-1.5 rounded-full bg-rose-400" />{" "}
                          Bị khóa
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {u.status === "ACTIVE" ? (
                        <button
                          onClick={() => handleToggleStatus(u.id, u.status)}
                          className="p-2 text-[#92929F] hover:text-rose-400 transition"
                          title="Khóa"
                        >
                          <Ban className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleStatus(u.id, u.status)}
                          className="p-2 text-[#92929F] hover:text-emerald-400 transition"
                          title="Mở khóa"
                        >
                          <Unlock className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* THÊM NÚT PHÂN TRANG */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-6 mt-6 pt-6 border-t border-white/[0.08]">
          <button
            onClick={() => {
              setPage((p) => p - 1);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            disabled={page === 1}
            className="px-5 py-2.5 rounded-xl border border-white/[0.08] bg-[#15151B] text-sm font-medium text-[#F5F5F7] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/[0.04]"
          >
            Trang trước
          </button>
          <span className="text-sm text-[#92929F]">
            Trang <strong className="text-[#F5F5F7]">{page}</strong> /{" "}
            {totalPages}
          </span>
          <button
            onClick={() => {
              setPage((p) => p + 1);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            disabled={page >= totalPages}
            className="px-5 py-2.5 rounded-xl border border-white/[0.08] bg-[#15151B] text-sm font-medium text-[#F5F5F7] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/[0.04]"
          >
            Trang sau
          </button>
        </div>
      )}
    </div>
  );
}
