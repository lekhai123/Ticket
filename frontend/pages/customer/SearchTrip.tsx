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
    <div className="min-h-[85vh] max-w-5xl mx-auto px-4 py-12 selection:bg-[#8B5CF6]/30">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-[#F5F5F7] mb-3">
          Hành trình của bạn bắt đầu từ đây
        </h1>
        <p className="text-sm text-[#92929F]">
          Nhập địa điểm, thời gian hoặc mô tả mong muốn để tìm chuyến xe phù hợp
          nhất.
        </p>
      </div>

      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#15151B] p-2.5 shadow-lg transition-all focus-within:border-[#8B5CF6]/50 focus-within:ring-1 focus-within:ring-[#8B5CF6]/50">
          <Search className="h-5 w-5 text-[#92929F] ml-3 flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ví dụ: Sài Gòn đi Đà Lạt sáng mai..."
            className="w-full bg-transparent text-sm md:text-base outline-none text-[#F5F5F7] placeholder:text-[#92929F]/60"
          />
          {query && (
            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 text-[#92929F] hover:text-[#F5F5F7] transition"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            type="submit"
            disabled={isSearching}
            className="rounded-xl bg-[#8B5CF6] px-6 py-2.5 text-sm font-medium text-white transition hover:bg-[#7C3AED] disabled:opacity-60 flex-shrink-0"
          >
            {isSearching ? "Đang tìm..." : "Tìm kiếm"}
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-center gap-2 mb-10 text-xs">
        <span className="text-[#92929F]">Gợi ý:</span>
        {["Đà Lạt", "Vũng Tàu", "Nha Trang", "Xe Limousine"].map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => handleQuickSearch(tag)}
            className="rounded-full border border-white/[0.08] bg-[#15151B] px-3 py-1.5 text-[#92929F] transition hover:bg-white/[0.04] hover:text-[#F5F5F7]"
          >
            {tag}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-400">
          Không thể tải dữ liệu tìm kiếm. Vui lòng thử lại sau.
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#92929F]">
            {query
              ? `Kết quả tìm kiếm (${trips.length})`
              : "Các chuyến xe sắp khởi hành"}
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-28 rounded-2xl border border-white/[0.08] bg-[#15151B]/50 animate-pulse"
              />
            ))}
          </div>
        ) : trips.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/[0.08] p-16 text-center bg-[#15151B]/30">
            <MapPin className="mx-auto h-10 w-10 text-[#92929F]/50 mb-3" />
            <p className="text-sm text-[#92929F]">
              Hiện chưa có chuyến xe nào phù hợp.
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
                className="group flex flex-col md:flex-row items-start md:items-center justify-between gap-6 rounded-2xl border border-white/[0.08] bg-[#15151B] p-6 transition-all hover:border-white/[0.15] hover:shadow-lg"
              >
                <div className="flex items-center gap-6 w-full md:w-auto">
                  <div className="flex flex-col">
                    <span className="text-2xl font-semibold tracking-tight text-[#F5F5F7]">
                      {timeString}
                    </span>
                    <span className="text-xs text-[#92929F] flex items-center gap-1 mt-1">
                      <Clock className="h-3 w-3" /> {dateString}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium text-[#F5F5F7]">
                      {origin}
                    </div>
                    <ArrowRight className="h-4 w-4 text-[#92929F] shrink-0" />
                    <div className="text-sm font-medium text-[#F5F5F7]">
                      {destination}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between w-full md:w-auto md:gap-8 pt-4 md:pt-0 border-t md:border-t-0 border-white/[0.08]">
                  <div className="flex flex-col md:items-end">
                    <span className="text-lg font-semibold text-[#F5F5F7]">
                      {formatCurrency(trip.price)}
                    </span>
                    <span
                      className={cn(
                        "text-xs flex items-center gap-1 font-medium mt-1",
                        isFull ? "text-rose-400" : "text-emerald-400",
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
                      "rounded-xl px-5 py-2.5 text-sm font-medium transition-all",
                      isFull
                        ? "bg-white/[0.04] text-[#92929F] cursor-not-allowed"
                        : "bg-[#8B5CF6] text-white hover:bg-[#7C3AED] shadow-[0_0_15px_rgba(139,92,246,0.3)]",
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
