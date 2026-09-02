// FILE: pages/customer/SearchTrip.tsx
import { useState } from "react";
import { Search, MapPin, Users, ArrowRight, X, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTrips } from "../../hooks/useTrips";
import { formatCurrency } from "../../utils/format";
import { cn } from "../../utils/cn";

export default function SearchTrip() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { searchTrips, clearSearch, isSearching, isLoading, trips, error } =
    useTrips();

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await searchTrips(query);
  };

  const handleReset = () => {
    setQuery("");
    clearSearch();
  };

  const handleQuickSearch = (keyword: string) => {
    setQuery(keyword);
    searchTrips(keyword);
  };

  return (
    <div className="min-h-[85vh] max-w-5xl mx-auto px-4 py-8">
      {/* Search Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-2">
          Tìm chuyến xe
        </h1>
        <p className="text-sm text-zinc-500">
          Nhập địa điểm, thời gian hoặc mô tả mong muốn để tìm vé xe phù hợp
        </p>
      </div>

      {/* Modern Search Bar */}
      <form onSubmit={handleSearch} className="mb-4">
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-2.5 shadow-sm transition-all focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-zinc-200/60 dark:border-zinc-800 dark:bg-zinc-900/90 dark:focus-within:border-zinc-600 dark:focus-within:ring-zinc-800">
          <Search className="h-5 w-5 text-zinc-400 ml-3 flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ví dụ: Sài Gòn đi Đà Lạt sáng mai, giá dưới 300k..."
            className="w-full bg-transparent text-sm md:text-base outline-none text-zinc-900 placeholder:text-zinc-400 dark:text-white"
          />

          {query && (
            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          <button
            type="submit"
            disabled={isSearching}
            className="rounded-xl bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 flex-shrink-0"
          >
            {isSearching ? "Đang tìm..." : "Tìm kiếm"}
          </button>
        </div>
      </form>

      {/* Quick Search Chips */}
      <div className="flex flex-wrap items-center gap-2 mb-10 text-xs">
        <span className="text-zinc-400">Gợi ý nhanh:</span>
        {["Đà Lạt", "Vũng Tàu", "Nha Trang", "Buổi sáng", "Xe Limousine"].map(
          (tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => handleQuickSearch(tag)}
              className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              {tag}
            </button>
          ),
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">
          Không thể tải dữ liệu tìm kiếm. Vui lòng thử lại sau.
        </div>
      )}

      {/* Danh sách chuyến xe */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {query
              ? `Kết quả tìm kiếm (${trips.length})`
              : "Các chuyến xe sắp khởi hành"}
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-28 rounded-2xl border border-zinc-200 bg-zinc-100/50 animate-pulse dark:border-zinc-800 dark:bg-zinc-900/50"
              />
            ))}
          </div>
        ) : trips.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 p-12 text-center dark:border-zinc-800">
            <MapPin className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600 mb-2" />
            <p className="text-sm text-zinc-500">
              Hiện chưa có chuyến xe nào phù hợp hoặc các chuyến đã khởi hành.
            </p>
          </div>
        ) : (
          trips.map((trip: any) => {
            const [origin, destination] = trip.route
              ? trip.route.split(" - ")
              : ["Điểm đi", "Điểm đến"];

            const departureDate = trip.departureAt
              ? new Date(trip.departureAt)
              : new Date();

            const timeString = departureDate.toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            });

            const dateString = departureDate.toLocaleDateString("vi-VN", {
              weekday: "short",
              day: "2-digit",
              month: "2-digit",
            });

            const availableSeats = trip.availableSeats ?? trip.totalSeats ?? 0;
            const isFull = availableSeats === 0;

            return (
              <div
                key={trip.id}
                className="group flex flex-col md:flex-row items-start md:items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-zinc-700"
              >
                {/* Thời gian & Tuyến đường */}
                <div className="flex items-center gap-5 w-full md:w-auto">
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                      {timeString}
                    </span>
                    <span className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" /> {dateString}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                      {origin}
                    </div>
                    <ArrowRight className="h-4 w-4 text-zinc-400 shrink-0" />
                    <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                      {destination}
                    </div>
                  </div>
                </div>

                {/* Chỗ trống, Giá vé & Nút chọn */}
                <div className="flex items-center justify-between w-full md:w-auto md:gap-8 pt-3 md:pt-0 border-t md:border-t-0 border-zinc-100 dark:border-zinc-800">
                  <div className="flex flex-col md:items-end">
                    <span className="text-lg font-bold text-zinc-900 dark:text-white">
                      {formatCurrency(trip.price)}
                    </span>
                    <span
                      className={cn(
                        "text-xs flex items-center gap-1 font-medium mt-0.5",
                        isFull
                          ? "text-rose-500"
                          : availableSeats <= 5
                            ? "text-amber-500"
                            : "text-emerald-500",
                      )}
                    >
                      <Users className="h-3.5 w-3.5" />
                      {isFull ? "Hết vé" : `Còn ${availableSeats} chỗ`}
                    </span>
                  </div>

                  <button
                    disabled={isFull}
                    onClick={() => navigate(`/booking/${trip.id}`)}
                    className={cn(
                      "rounded-xl px-5 py-2.5 text-sm font-medium transition",
                      isFull
                        ? "bg-zinc-100 text-zinc-400 cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-500"
                        : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm",
                    )}
                  >
                    {isFull ? "Hết chỗ" : "Chọn ghế"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
