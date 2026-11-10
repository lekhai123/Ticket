import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");

export const options = {
  stages: [
    { duration: "10s", target: 20 },
    { duration: "1m", target: 50 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"],
    errors: ["rate<0.05"], // Tỷ lệ lỗi server thực sự phải < 5%
  },
};

const BASE_URL = "URL_xxxxxxxxxxxxxxxxxxxxxxxxxxx";

export function setup() {
  const headers = {
    "Content-Type": "application/json",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/json",
  };

  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({
      email: "Email",
      password: "Password",
    }),
    { headers },
  );

  if (loginRes.status !== 200) {
    throw new Error(`Đăng nhập thất bại với HTTP Status: ${loginRes.status}`);
  }

  const body = loginRes.json();
  const token = body?.data?.accessToken || body?.accessToken;

  if (!token) {
    throw new Error("Không tìm thấy accessToken trong response!");
  }

  console.log("Lấy Token thành công, bắt đầu...");
  return { token };
}

export default function (data) {
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${data.token}`,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };

  //1: Lấy danh sách chuyến xe
  const tripsRes = http.get(`${BASE_URL}/trips?page=1&limit=12`);
  const tripsOk = check(tripsRes, {
    "Lấy danh sách chuyến xe thành công (200)": (r) => r.status === 200,
  });
  if (!tripsOk) errorRate.add(1);

  sleep(1);

  // 2: Đặt vé (Test chống Race Condition)
  const ticketRes = http.post(
    `${BASE_URL}/bookings`,
    JSON.stringify({
      tripId: 100, // Đảm bảo Trip ID 1 có thật trong DB
      seatNumbers: [99], // Ghế 99 phải là ghế trống
      paymentMethod: "WALLET",
      batchId: `LOAD_TEST_${Math.random()}`,
    }),
    { headers: authHeaders },
  );

  // Các mã hợp lệ khi tranh chấp: 201 (Mua được), 400/409 (Bị lock hoặc lỗi nghiệp vụ)
  const isValidBusinessResponse = [201, 400, 403, 409].includes(
    ticketRes.status,
  );
  const isServerError = ticketRes.status >= 500;

  // NẾU LỖI 500 HOẶC LỖI MẠNG -> IN RA MÀN HÌNH ĐỂ DEBUG
  if (!isValidBusinessResponse) {
    console.log(`\nREQUEST THẤT BẠI (Status: ${ticketRes.status})`);
    console.log(` Nội dung: ${ticketRes.body}\n`);
    errorRate.add(1); // Đánh dấu đây là lỗi thật sự
  } else {
    errorRate.add(0); // Không tính là lỗi (Dù bị 400/409 do lock ghế cũng là đúng)
  }

  check(ticketRes, {
    "Đặt vé thành công hoặc bị Lock chặn": () => isValidBusinessResponse,
    "Không bị lỗi Server (500)": () => !isServerError,
  });

  sleep(1);
}
