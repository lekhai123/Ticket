import { useState } from "react";
import { Search, Sparkles, MapPin, Users, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom"; // 👈 1. Import useNavigate
import { Button } from "../../components/ui/Button";
import { useTrips } from "../../hooks/useTrips";
import { formatCurrency } from "../../utils/format";

export default function SearchTrip() {
  const [prompt, setPrompt] = useState("");
  const navigate = useNavigate(); // 👈 2. Khởi tạo hook navigate
  const { semanticSearch, isSearching, trips, error } = useTrips();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    try {
      await semanticSearch(prompt);
    } catch (err) {
      console.error("Search failed:", err);
    }
  };

  // Hàm xử lý khi bấm chọn ghế chuyến xe
  const handleSelectTrip = (tripId: number | string) => {
    navigate(`/booking/${tripId}`); // 👈 Chuyển hướng sang trang booking đúng id chuyến
  };

  return (
    <div className="flex flex-col items-center pt-16 px-4 min-h-[80vh]">
      <div className="text-center mb-10 max-w-2xl animate-in fade-in slide-in-from-bottom-4">
        <h1 className="text-4xl font-bold tracking-tight mb-4 text-zinc-900 dark:text-white">
          Trải nghiệm đặt vé bằng AI
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Hãy mô tả chuyến đi của bạn. Ví dụ: <br />
          <span className="italic font-medium text-indigo-500">
            "Tôi muốn đi Đà Lạt cuối tuần này, giá rẻ, xe buổi sáng."
          </span>
        </p>
      </div>

      <form onSubmit={handleSearch} className="w-full max-w-3xl relative group">
        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-20 blur-lg transition duration-500 group-hover:opacity-40" />

        <div className="relative flex flex-col sm:flex-row items-center gap-2 rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 p-2 shadow-xl">
          <div className="flex-1 flex items-center px-4 w-full">
            <Sparkles className="h-5 w-5 text-indigo-500 mr-3 animate-pulse flex-shrink-0" />
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Nhập yêu cầu của bạn..."
              className="w-full bg-transparent h-12 text-base sm:text-lg outline-none text-zinc-900 dark:text-white placeholder:text-zinc-400"
            />
          </div>
          <Button
            type="submit"
            isLoading={isSearching}
            className="w-full sm:w-auto rounded-xl px-8"
          >
            {!isSearching && <Search className="mr-2 h-4 w-4" />}
            Tìm bằng AI
          </Button>
        </div>
      </form>

      {error && (
        <p className="mt-6 text-red-500 font-medium bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg">
          {(error as any)?.message || "Đã có lỗi xảy ra khi gọi AI."}
        </p>
      )}

      {/* Render Danh sách Chuyến đi */}
      <div className="w-full max-w-4xl mt-16 grid gap-4">
        {trips.length > 0 && (
          <h3 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-white">
            {prompt ? "Đề xuất từ AI" : "Chuyến xe nổi bật"}
          </h3>
        )}

        {trips.map((trip: any) => {
          const [origin, destination] = trip.route
            ? trip.route.split(" - ")
            : ["--", "--"];

          const departureDate = trip.departureAt
            ? new Date(trip.departureAt)
            : new Date();

          const timeString = departureDate.toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <div
              key={trip.id}
              className="group flex flex-col md:flex-row items-start md:items-center justify-between p-6 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 transition-all hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-900/50"
            >
              <div className="flex items-center gap-6 w-full md:w-auto mb-4 md:mb-0">
                <div className="flex flex-col items-center">
                  <span className="text-xl font-bold">{timeString}</span>
                  <span className="text-sm text-zinc-500 font-medium">
                    {origin}
                  </span>
                </div>
                <div className="flex-1 md:w-32 flex flex-col items-center relative px-2">
                  <div className="h-0.5 w-full bg-zinc-200 dark:bg-zinc-800 absolute top-1/2 -translate-y-1/2" />
                  <ArrowRight className="h-4 w-4 text-zinc-400 bg-white dark:bg-zinc-950 relative z-10" />
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-xl font-bold">
                    {trip.arrivalTime
                      ? new Date(trip.arrivalTime).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "--:--"}
                  </span>
                  <span className="text-sm text-zinc-500 font-medium">
                    {destination}
                  </span>
                </div>
              </div>

              <div className="flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-2">
                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {formatCurrency(trip.price)}
                </div>
                <p className="text-sm text-amber-600 font-medium flex items-center gap-1">
                  <Users className="h-4 w-4" /> Còn{" "}
                  {trip.availableSeats ?? trip.totalSeats ?? 0} chỗ
                </p>
                {/* 3. Thêm sự kiện onClick để chuyển hướng sang trang chọn ghế */}
                <Button
                  size="sm"
                  className="hidden md:inline-flex mt-2"
                  onClick={() => handleSelectTrip(trip.id)}
                >
                  Chọn ghế
                </Button>
              </div>
              <Button
                className="w-full md:hidden mt-4"
                onClick={() => handleSelectTrip(trip.id)}
              >
                Chọn ghế
              </Button>
            </div>
          );
        })}

        {/* Empty State */}
        {!isSearching && trips.length === 0 && !error && (
          <div className="text-center py-20">
            <MapPin className="mx-auto h-12 w-12 text-zinc-300 mb-4" />
            <p className="text-zinc-500">
              Không tìm thấy chuyến xe nào phù hợp với yêu cầu của bạn.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
