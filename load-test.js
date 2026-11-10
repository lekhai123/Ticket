import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

// Khai báo biến đo tỷ lệ lỗi
const errorRate = new Rate("errors");

// Cấu hình kịch bản Load Test
export const options = {
  stages: [
    { duration: "30s", target: 50 }, // 30 giây đầu: Tăng dần lên 50 user ảo (VUs)
    { duration: "1m", target: 100 }, // 1 phút tiếp theo: Duy trì 100 user ảo cùng bắn request
    { duration: "30s", target: 0 }, // 30 giây cuối: Giảm dần về 0
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"], // 95% request phải phản hồi dưới 2 giây
    errors: ["rate<0.05"], // Tỷ lệ lỗi phải dưới 5%
  },
};

const BASE_URL = "https://ticket-lekhai.vercel.app/"; // Thay bằng domain Vercel của bạn nếu muốn test production

// Hàm setup() chạy 1 lần duy nhất trước khi bắt đầu bắn tải
export function setup() {
  // 1. Đăng nhập để lấy Access Token
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({
      email: process.env.userTest, // TK test của bạn
      password: process.env.passUserTest,
    }),
    { headers: { "Content-Type": "application/json" } },
  );

  const token = loginRes.json().data.accessToken;
  return { token }; // Truyền token xuống cho các user ảo dùng chung
}

// Hàm default() chạy liên tục cho mỗi user ảo
export default function (data) {
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${data.token}`,
  };

  // ==========================================
  // KỊCH BẢN 1: ĐỌC (Lấy danh sách chuyến xe - Có Cache)
  // ==========================================
  const tripsRes = http.get(`${BASE_URL}/trips?page=1&limit=12`);

  check(tripsRes, {
    "Lấy danh sách chuyến xe thành công (200)": (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(1); // Nghỉ 1 giây giữa các lần gọi

  // ==========================================
  // KỊCH BẢN 2: GHI (Đặt vé - Test chống Race Condition/Overselling)
  // ==========================================
  // Chúng ta sẽ cố tình cho 100 user cùng đặt ghế A99.
  // Kì vọng: 1 user thành công (201), 99 user báo lỗi 400/409 (Ghế đã có người đặt).

  const ticketRes = http.post(
    `${BASE_URL}/bookings`,
    JSON.stringify({
      tripId: 1, // ID chuyến xe có thật trong DB của bạn
      seatNumbers: [99], // Cố tình dùng 1 ghế cố định
      paymentMethod: "WALLET",
      batchId: `LOAD_TEST_${Math.random()}`,
    }),
    { headers: authHeaders },
  );

  // Kiểm tra: Nếu thành công thì phải là 201 (Created)
  // Nếu bị trùng ghế, API sẽ văng lỗi 400 hoặc 409 (Conflict) - ĐÂY LÀ ĐIỀU TỐT.
  const isSuccess = ticketRes.status === 201;
  const isLockedByOther = ticketRes.status === 400 || ticketRes.status === 409;

  check(ticketRes, {
    "Đặt vé thành công hoặc bị Lock chặn": () => isSuccess || isLockedByOther,
    "Không bị lỗi Server (500)": (r) => r.status !== 500,
  }) || errorRate.add(1);

  sleep(1);
}
