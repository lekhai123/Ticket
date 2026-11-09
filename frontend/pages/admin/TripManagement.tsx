import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tripApi, Trip } from "../../api/trip.api";
import { cn } from "../../utils/cn";

export default function TripManagement() {
  const queryClient = useQueryClient();
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // State quản lý trang hiện tại
  const [page, setPage] = useState(1);

  // Form states
  const [route, setRoute] = useState("");
  const [departureAt, setDepartureAt] = useState("");
  const [price, setPrice] = useState(250000);
  const [totalSeats, setTotalSeats] = useState(30);
  const [description, setDescription] = useState("");

  //  Lấy danh sách chuyến xe dành cho Admin (có phân trang)
  const { data: response, isLoading } = useQuery({
    queryKey: ["admin-trips", page],
    queryFn: () => tripApi.getAllForAdmin(page, 10),
  });

  const trips = response?.data || [];

  //  TÁCH RIÊNG BIẾN TOTAL PAGES ĐỂ TRÁNH LỖI TYPESCRIPT UNDEFINED
  const totalPages = response?.meta?.totalPages ?? 1;

  const openCreateModal = () => {
    setEditingTrip(null);
    setRoute("");
    setDepartureAt(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
    setPrice(250000);
    setTotalSeats(30);
    setDescription("");
    setIsModalOpen(true);
  };

  const openEditModal = (trip: Trip) => {
    setEditingTrip(trip);
    setRoute(trip.route);
    setDepartureAt(new Date(trip.departureAt).toISOString().slice(0, 16));
    setPrice(trip.price);
    setTotalSeats(trip.totalSeats || 30);
    setDescription(trip.description || "");
    setIsModalOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        route,
        departureAt: new Date(departureAt).toISOString(),
        price: Number(price),
        totalSeats: Number(totalSeats),
        description,
      };

      if (editingTrip) {
        return await tripApi.update(editingTrip.id, payload);
      } else {
        return await tripApi.create(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-trips"] });
      queryClient.invalidateQueries({ queryKey: ["trips", "default"] });
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      alert(err.message || "Có lỗi xảy ra khi lưu!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: tripApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-trips"] });
      queryClient.invalidateQueries({ queryKey: ["trips", "default"] });
    },
    onError: (err: any) => {
      alert(err.message || "Không thể xoá chuyến xe này!");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#F5F5F7]">
            Quản lý Chuyến xe
          </h1>
          <p className="text-sm text-[#92929F] mt-1">
            Thêm, sửa, xoá và theo dõi số chỗ thực tế.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-[#8B5CF6] hover:bg-[#7C3AED] px-4 py-2 rounded-xl text-sm font-medium text-white transition-all shadow-[0_0_15px_rgba(139,92,246,0.3)]"
        >
          + Thêm chuyến
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#15151B]">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="border-b border-white/[0.08] text-[#92929F]">
            <tr>
              <th className="p-4 font-medium">ID</th>
              <th className="p-4 font-medium">Tuyến xe</th>
              <th className="p-4 font-medium">Khởi hành</th>
              <th className="p-4 font-medium">Giá vé</th>
              <th className="p-4 font-medium text-center">Chỗ trống</th>
              <th className="p-4 font-medium text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-[#92929F]">
                  Đang tải...
                </td>
              </tr>
            ) : trips.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-[#92929F]">
                  Chưa có chuyến xe nào
                </td>
              </tr>
            ) : (
              trips.map((trip) => (
                <tr
                  key={trip.id}
                  className="hover:bg-white/[0.02] transition-colors"
                >
                  <td className="p-4 font-mono text-xs text-[#92929F]">
                    #{trip.id}
                  </td>
                  <td className="p-4 font-medium text-[#F5F5F7]">
                    {trip.route}
                  </td>
                  <td className="p-4 text-[#92929F]">
                    {new Date(trip.departureAt).toLocaleString("vi-VN")}
                  </td>
                  <td className="p-4 font-medium text-[#F5F5F7]">
                    {trip.price.toLocaleString("vi-VN")} đ
                  </td>
                  <td className="p-4 text-center">
                    <span
                      className={cn(
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                        trip.availableSeats === 0
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                      )}
                    >
                      {trip.availableSeats} / {trip.totalSeats}
                    </span>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button
                      onClick={() => openEditModal(trip)}
                      className="px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-[#F5F5F7] rounded-lg text-xs transition"
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Xóa chuyến #${trip.id}?`))
                          deleteMutation.mutate(trip.id);
                      }}
                      className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-xs transition"
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* NÚT PHÂN TRANG (Sử dụng biến totalPages đã tách) */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-6 mt-6 pt-6 border-t border-white/[0.08]">
          <button
            onClick={() => {
              setPage((p) => p - 1);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            disabled={page === 1}
            className="px-5 py-2.5 rounded-xl border border-white/[0.08] bg-[#15151B] text-sm font-medium text-[#F5F5F7] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/[0.04] transition-colors"
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
            className="px-5 py-2.5 rounded-xl border border-white/[0.08] bg-[#15151B] text-sm font-medium text-[#F5F5F7] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/[0.04] transition-colors"
          >
            Trang sau
          </button>
        </div>
      )}

      {/* Modal Thêm / Cập nhật (Giữ nguyên) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/[0.08] bg-[#15151B] p-6 shadow-2xl">
            <h2 className="text-lg font-semibold mb-5 text-[#F5F5F7]">
              {editingTrip
                ? `Chỉnh sửa chuyến #${editingTrip.id}`
                : "Thêm chuyến mới"}
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate();
              }}
              className="space-y-4 text-sm"
            >
              <div>
                <label className="block text-[#92929F] mb-1.5">Tuyến xe</label>
                <input
                  required
                  value={route}
                  onChange={(e) => setRoute(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#0D0D10] px-3 py-2 text-[#F5F5F7] focus:border-[#8B5CF6] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[#92929F] mb-1.5">
                  Thời gian khởi hành
                </label>
                <input
                  type="datetime-local"
                  required
                  value={departureAt}
                  onChange={(e) => setDepartureAt(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#0D0D10] px-3 py-2 text-[#F5F5F7] focus:border-[#8B5CF6] focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#92929F] mb-1.5">Giá vé</label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    required
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full rounded-xl border border-white/[0.08] bg-[#0D0D10] px-3 py-2 text-[#F5F5F7] focus:border-[#8B5CF6] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#92929F] mb-1.5">Số ghế</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    required
                    value={totalSeats}
                    onChange={(e) => setTotalSeats(Number(e.target.value))}
                    className="w-full rounded-xl border border-white/[0.08] bg-[#0D0D10] px-3 py-2 text-[#F5F5F7] focus:border-[#8B5CF6] focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[#92929F] mb-1.5">Mô tả</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#0D0D10] px-3 py-2 text-[#F5F5F7] focus:border-[#8B5CF6] focus:outline-none"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-[#92929F] hover:bg-white/[0.04] transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="rounded-xl bg-[#8B5CF6] px-4 py-2 font-medium text-white hover:bg-[#7C3AED] disabled:opacity-50 transition"
                >
                  {saveMutation.isPending ? "Đang lưu..." : "Lưu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
