import { useState } from "react";
import { Search, Filter, Ban, Unlock } from "lucide-react";
import { useUsers } from "../../hooks/useUser";
import { VipBadge } from "../../components/common/VipBadge";
import { Input } from "../../components/ui/Input";
import { formatCurrency } from "../../utils/format";
import { cn } from "../../utils/cn";

export default function Users() {
  const [search, setSearch] = useState("");
  const { users, isLoading, updateStatus } = useUsers({ search });

  // Đảm bảo userList luôn luôn là một mảng để không bị văng lỗi .map()
  const userList = Array.isArray(users)
    ? users
    : (users as any)?.users ||
      (users as any)?.data?.users ||
      (users as any)?.data ||
      [];
  const handleToggleStatus = async (userId: number, currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "BANNED" : "ACTIVE";
    const actionName = newStatus === "BANNED" ? "KHÓA" : "MỞ KHÓA";

    if (confirm(`Bạn có chắc chắn muốn ${actionName} tài khoản này không?`)) {
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
          <h1 className="text-2xl font-bold tracking-tight">
            Quản lý Người Dùng
          </h1>
          <p className="text-sm text-zinc-500">
            Giám sát và phân quyền toàn bộ tài khoản trên hệ thống.
          </p>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative max-w-md w-full">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo Tên, Email..."
            className="w-full bg-white dark:bg-zinc-950 pl-10"
          />
          <Search className="absolute left-3 top-3 h-5 w-5 text-zinc-400" />
        </div>
        <button className="flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900">
          <Filter className="mr-2 h-4 w-4" /> Bộ lọc
        </button>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900/50">
            <tr>
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">VIP Level</th>
              <th className="px-6 py-4">Ví / Số dư</th>
              <th className="px-6 py-4">Trạng thái</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-zinc-500">
                  Đang tải dữ liệu người dùng...
                </td>
              </tr>
            ) : userList.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-zinc-500">
                  Không tìm thấy người dùng nào.
                </td>
              </tr>
            ) : (
              userList.map((u: any) => {
                // Đọc tên người dùng an toàn (fullName -> name -> fallback)
                const userName = u.fullName || u.name || "Người dùng";
                const userInitial = userName.charAt(0).toUpperCase();

                return (
                  <tr
                    key={u.id}
                    className="transition hover:bg-zinc-50 dark:hover:bg-zinc-900/30"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold dark:bg-indigo-900/30 dark:text-indigo-400">
                          {userInitial}
                        </div>
                        <div>
                          <p className="font-semibold">{userName}</p>
                          <p className="text-xs text-zinc-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "inline-flex rounded-md px-2 py-1 text-xs font-semibold",
                          u.role === "ADMIN"
                            ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                            : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
                        )}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <VipBadge level={u.vipLevel ?? u.vip_level ?? 0} />
                    </td>
                    <td className="px-6 py-4 font-mono font-medium text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(u.balance ?? u.wallet?.balance ?? 0)}
                    </td>
                    <td className="px-6 py-4">
                      {u.status === "ACTIVE" ? (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                          <div className="h-2 w-2 rounded-full bg-emerald-500" />{" "}
                          Hoạt động
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                          <div className="h-2 w-2 rounded-full bg-red-500" /> Bị
                          khóa
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {u.status === "ACTIVE" ? (
                        <button
                          onClick={() => handleToggleStatus(u.id, u.status)}
                          className="p-2 text-zinc-400 hover:text-red-500 transition"
                          title="Khóa tài khoản"
                        >
                          <Ban className="h-5 w-5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleStatus(u.id, u.status)}
                          className="p-2 text-zinc-400 hover:text-emerald-500 transition"
                          title="Mở khóa"
                        >
                          <Unlock className="h-5 w-5" />
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
    </div>
  );
}
