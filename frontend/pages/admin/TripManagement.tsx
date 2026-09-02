import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tripApi, Trip } from "../../api/trip.api";

export default function TripManagement() {
  const queryClient = useQueryClient();
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [route, setRoute] = useState("");
  const [departureAt, setDepartureAt] = useState("");
  const [price, setPrice] = useState(250000);
  const [totalSeats, setTotalSeats] = useState(30);
  const [description, setDescription] = useState("");

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ["admin-trips"],
    queryFn: tripApi.getAll,
  });

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
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || "Có lỗi xảy ra khi lưu!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: tripApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-trips"] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || "Không thể xoá chuyến xe này!");
    },
  });

  return (
    <div className="p-6 text-zinc-100 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Quản lý Chuyến xe</h1>
          <p className="text-sm text-zinc-400">Thêm, sửa, xoá và theo dõi số chỗ thực tế theo thời gian thực</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg font-medium text-sm transition"
        >
          + Thêm chuyến mới
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/50">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-800/40 text-zinc-400">
            <tr>
              <th className="p-4">ID</th>
              <th className="p-4">Tuyến xe</th>
              <th className="p-4">Khởi hành</th>
              <th className="p-4">Giá vé</th>
              <th className="p-4 text-center">Chỗ trống / Tổng</th>
              <th className="p-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-zinc-500">Đang tải dữ liệu...</td>
              </tr>
            ) : trips.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-zinc-500">Chưa có chuyến xe nào</td>
              </tr>
            ) : (
              trips.map((trip) => (
                <tr key={trip.id} className="hover:bg-zinc-800/30 transition">
                  <td className="p-4 font-mono text-xs text-zinc-500">#{trip.id}</td>
                  <td className="p-4 font-medium text-white">{trip.route}</td>
                  <td className="p-4 text-zinc-300">
                    {new Date(trip.departureAt).toLocaleString("vi-VN")}
                  </td>
                  <td className="p-4 font-semibold text-emerald-400">
                    {trip.price.toLocaleString("vi-VN")} đ
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      trip.availableSeats === 0
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    }`}>
                      {trip.availableSeats} / {trip.totalSeats} chỗ
                    </span>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button
                      onClick={() => openEditModal(trip)}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs transition"
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Bạn có chắc muốn xóa chuyến #${trip.id}?`)) {
                          deleteMutation.mutate(trip.id);
                        }
                      }}
                      className="px-3 py-1.5 bg-rose-950/40 border border-rose-800 hover:bg-rose-900 text-rose-300 rounded text-xs transition"
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

      {/* Modal Thêm / Cập nhật */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-4">
              {editingTrip ? `Chỉnh sửa chuyến #${editingTrip.id}` : "Thêm chuyến xe mới"}
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate();
              }}
              className="space-y-4 text-sm"
            >
              <div>
                <label className="block text-zinc-400 mb-1">Tuyến xe (VD: Sài Gòn - Đà Lạt)</label>
                <input
                  required
                  value={route}
                  onChange={(e) => setRoute(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Thời gian khởi hành</label>
                <input
                  type="datetime-local"
                  required
                  value={departureAt}
                  onChange={(e) => setDepartureAt(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">Giá vé (VNĐ)</label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    required
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Tổng số ghế</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    required
                    value={totalSeats}
                    onChange={(e) => setTotalSeats(Number(e.target.value))}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Mô tả / Tiện ích (Hỗ trợ AI Search)</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Xe limousine giường phòng, wifi, đón tận nơi..."
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-zinc-400 hover:bg-zinc-800 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 transition disabled:opacity-50"
                >
                  {saveMutation.isPending ? "Đang lưu..." : "Lưu chuyến"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}