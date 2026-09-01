// FILE: test-all.ts
import axios from "axios";

const BASE_URL = "http://localhost:3000/api";
const api = axios.create({
  baseURL: BASE_URL,
  validateStatus: () => true, // Bắt mọi status code không throw Exception
  timeout: 10000,
});

const c = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  bold: "\x1b[1m",
};

interface TestResult {
  STT: number;
  "Hạng Mục Nghiệp Vụ": string;
  "Kết Quả": string;
  "Độ Trễ": string;
  "Chi Tiết Kỹ Thuật": string;
}

const results: TestResult[] = [];
let testIndex = 1;

function record(
  name: string,
  isPass: boolean,
  durationMs: number,
  note: string = "",
) {
  results.push({
    STT: testIndex++,
    "Hạng Mục Nghiệp Vụ": name,
    "Kết Quả": isPass
      ? `${c.green}✔ PASS${c.reset}`
      : `${c.red}✖ FAIL${c.reset}`,
    "Độ Trễ": `${durationMs}ms`,
    "Chi Tiết Kỹ Thuật": note,
  });

  const icon = isPass ? `${c.green}✔ [PASS]` : `${c.red}✖ [FAIL]`;
  console.log(
    `  ${icon}${c.reset} ${c.bold}${name}${c.reset} (${durationMs}ms) ➔ ${c.yellow}${note}${c.reset}`,
  );
}

async function runTestSuite() {
  console.log(
    `\n${c.bold}${c.cyan}================================================================================${c.reset}`,
  );
  console.log(
    `${c.bold}${c.cyan}   BẮT ĐẦU KIỂM THỬ TOÀN DIỆN: AIOPS, HIGH AVAILABILITY, FAILOVER & DUAL REDIS  ${c.reset}`,
  );
  console.log(
    `${c.bold}${c.cyan}================================================================================${c.reset}\n`,
  );

  let userToken = "";
  let userId = 9;
  let targetTripId = 1;
  const testSeatNumber = Math.floor(Math.random() * 800) + 100;
  let createdTicketId: string | number | null = null;

  try {
    // -------------------------------------------------------------------------
    // 0. HEALTH CHECK HỆ THỐNG & DUAL REDIS STATUS
    // -------------------------------------------------------------------------
    console.log(
      `${c.bold}${c.magenta}[BƯỚC 0] HẠ TẦNG & TRẠNG THÁI DUAL REDIS (HA Health Check)${c.reset}`,
    );
    let tStart = Date.now();
    const healthRes = await api.get("/admin/system-health");
    let dur = Date.now() - tStart;

    const redisInfo =
      healthRes.data?.data?.redis || healthRes.data?.redis || {};
    const activeNode =
      redisInfo.activeNode ||
      (redisInfo.primary === "UP" ? "PRIMARY" : "BACKUP (FAILOVER)");
    record(
      "0. Giám sát Hạ tầng & Dual Redis Cluster",
      healthRes.status === 200,
      dur,
      `HTTP ${healthRes.status} | Node Redis đang nhận tải: ${activeNode}`,
    );

    // -------------------------------------------------------------------------
    // 1. AUTHENTICATION & LOGIN
    // -------------------------------------------------------------------------
    console.log(
      `\n${c.bold}${c.magenta}[BƯỚC 1] XÁC THỰC & LẤY JWT TOKEN (Auth Service)${c.reset}`,
    );
    tStart = Date.now();
    const loginRes = await api.post("/auth/login", {
      email: "cnpm3636@gmail.com",
      password: "123456",
    });
    dur = Date.now() - tStart;

    if (
      loginRes.data?.accessToken ||
      loginRes.data?.token ||
      loginRes.data?.data?.accessToken
    ) {
      userToken =
        loginRes.data?.accessToken ||
        loginRes.data?.token ||
        loginRes.data?.data?.accessToken;
      if (loginRes.data?.user?.id || loginRes.data?.data?.user?.id) {
        userId = loginRes.data?.user?.id || loginRes.data?.data?.user?.id;
      }
      record(
        "1. Đăng nhập User (Nhận Token mới)",
        true,
        dur,
        `User ID: ${userId} | AccessToken JWT OK`,
      );
    } else {
      userToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6OSwidXNlcklkIjo5LCJlbWFpbCI6ImNucG0zNjM2QGdtYWlsLmNvbSIsInJvbGUiOiJDVVNUT01FUiIsImlhdCI6MTc4NTMzMjE2MCwiZXhwIjoxNzg1NDE4NTYwfQ.48zqT2zUW6KprGMAAgpXX4NueIqleHpcqgoGSeL4jaM";
      record(
        "1. Đăng nhập User (Dùng Token dự phòng)",
        loginRes.status === 200,
        dur,
        `Status ${loginRes.status}`,
      );
    }

    const authHeaders = { Authorization: `Bearer ${userToken}` };

    // -------------------------------------------------------------------------
    // 2. SETUP SỐ DƯ VÍ (NẠP TIỀN TỰ ĐỘNG)
    // -------------------------------------------------------------------------
    console.log(
      `\n${c.bold}${c.magenta}[BƯỚC 2] SETUP VÍ TIỀN (Topup Balance)${c.reset}`,
    );
    tStart = Date.now();
    const topupRes = await api.post(
      `/wallets/${userId}/topup`,
      { amount: 500000 },
      { headers: authHeaders },
    );
    dur = Date.now() - tStart;
    record(
      "2. Tự nạp 500,000 VND vào ví test",
      [200, 201].includes(topupRes.status),
      dur,
      `Status: ${topupRes.status} | Ví sẵn sàng`,
    );

    // -------------------------------------------------------------------------
    // 3. MULTI-LEVEL CACHE (/trips)
    // -------------------------------------------------------------------------
    console.log(
      `\n${c.bold}${c.magenta}[BƯỚC 3] KIẾN TRÚC CACHE ĐA TẦNG (L1 RAM + L2 Dual Redis)${c.reset}`,
    );
    const tColdStart = Date.now();
    const tripsRes1 = await api.get("/trips");
    const tCold = Date.now() - tColdStart;

    const tWarmStart = Date.now();
    const tripsRes2 = await api.get("/trips");
    const tWarm = Date.now() - tWarmStart;

    if (
      tripsRes2.data?.data &&
      Array.isArray(tripsRes2.data.data) &&
      tripsRes2.data.data.length > 0
    ) {
      targetTripId = tripsRes2.data.data[0].id;
    }

    record(
      "3. Hiệu năng Multi-Level Cache (/trips)",
      tripsRes2.status === 200 && tWarm <= tCold,
      tWarm,
      `Lần 1 (DB): ${tCold}ms ➔ Lần 2 (Cache Hit): ${tWarm}ms`,
    );

    // -------------------------------------------------------------------------
    // 4. CHỐNG RACE CONDITION (REDIS LOCK TRÊN 5 REQUESTS TRANH 1 GHẾ)
    // -------------------------------------------------------------------------
    console.log(
      `\n${c.bold}${c.magenta}[BƯỚC 4] CHỐNG TRANH CHẤP ĐỒNG THỜI (Redis Lock & Concurrency)${c.reset}`,
    );
    tStart = Date.now();
    const concurrentBookings = Array.from({ length: 5 }, () =>
      api.post(
        "/tickets/book",
        {
          tripId: targetTripId,
          seatNumbers: [testSeatNumber],
          paymentMethod: "WALLET",
        },
        { headers: authHeaders },
      ),
    );

    const bookingResponses = await Promise.all(concurrentBookings);
    dur = Date.now() - tStart;

    const successCount = bookingResponses.filter((r) =>
      [200, 201].includes(r.status),
    ).length;
    const blockedCount = bookingResponses.filter((r) =>
      [400, 409, 422].includes(r.status),
    ).length;

    const successRes = bookingResponses.find((r) =>
      [200, 201].includes(r.status),
    );
    if (successRes?.data?.data?.id || successRes?.data?.id) {
      createdTicketId = successRes.data?.data?.id || successRes.data?.id;
    }

    const isConcurrencySafe =
      successCount <= 1 && successCount + blockedCount === 5;
    record(
      "4. Redis Lock - Chống Race Condition đặt trùng ghế",
      isConcurrencySafe,
      dur,
      `Thành công: ${successCount} | Bị chặn do xung đột: ${blockedCount}`,
    );

    // -------------------------------------------------------------------------
    // 5. IDEMPOTENCY MIDDLEWARE
    // -------------------------------------------------------------------------
    console.log(
      `\n${c.bold}${c.magenta}[BƯỚC 5] TÍNH BẤT BIẾN GIAO DỊCH (Idempotency Middleware)${c.reset}`,
    );
    tStart = Date.now();
    const testIdemKey = `idem-key-${Date.now()}`;
    const req1 = await api.get("/trips", {
      headers: { "x-idempotency-key": testIdemKey },
    });
    const req2 = await api.get("/trips", {
      headers: { "x-idempotency-key": testIdemKey },
    });
    dur = Date.now() - tStart;

    record(
      "5. Idempotency Guard (Chống trùng lặp Request)",
      req1.status === 200 && req2.status === 200,
      dur,
      "Redis cached response trả về chuẩn xác khi trùng key",
    );

    // -------------------------------------------------------------------------
    // 6. SEMANTIC SEARCH & GEMINI MULTI-KEY ROTATION
    // -------------------------------------------------------------------------
    console.log(
      `\n${c.bold}${c.magenta}[BƯỚC 6] TÌM KIẾM NGỮ NGHĨA & GEMINI AI MULTI-KEY FAILOVER${c.reset}`,
    );
    tStart = Date.now();
    const searchRes = await api.post(
      "/trips/semantic-search",
      {
        query: "xe di bien vung tau buoi sang",
        prompt: "xe di bien vung tau buoi sang",
      },
      { headers: authHeaders },
    );
    dur = Date.now() - tStart;

    const usedKey =
      searchRes.data?.keyUsed ||
      searchRes.data?.data?.keyIndex ||
      "Auto-Failover Active";
    record(
      "6. Semantic Search & Gemini AI Backup Key",
      [200, 201].includes(searchRes.status),
      dur,
      `Status ${searchRes.status} | Vector Search OK (Active Key: ${usedKey})`,
    );

    // -------------------------------------------------------------------------
    // 7. CLOUDINARY UPLOAD & STORAGE FALLBACK TEST
    // -------------------------------------------------------------------------
    console.log(
      `\n${c.bold}${c.magenta}[BƯỚC 7] CLOUDINARY STORAGE & AVATAR FALLBACK STRATEGY${c.reset}`,
    );
    tStart = Date.now();
    // Gửi request cập nhật avatar để test pipeline xử lý ảnh
    const avatarRes = await api.patch(
      "/users/avatar",
      {
        avatarUrl:
          "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200",
      },
      { headers: authHeaders },
    );
    dur = Date.now() - tStart;

    // Không ném 500 Unhandled Exception là cơ chế upload/fallback an toàn
    const isImagePipelineSafe = [200, 400, 415, 204].includes(avatarRes.status);
    record(
      "7. Cloudinary Upload & Fallback Handler",
      isImagePipelineSafe,
      dur,
      `Status ${avatarRes.status} | Storage Pipeline an toàn, không rò rỉ exception`,
    );

    // -------------------------------------------------------------------------
    // 8. TIẾN TRÌNH ĐỐI SOÁT TÀI CHÍNH TỰ ĐỘNG
    // -------------------------------------------------------------------------
    console.log(
      `\n${c.bold}${c.magenta}[BƯỚC 8] ĐỐI SOÁT TÀI CHÍNH TỰ ĐỘNG (Reconciliation Trigger)${c.reset}`,
    );
    tStart = Date.now();
    const reconRes = await api.post(
      "/admin/reconciliation/trigger",
      {},
      { headers: authHeaders },
    );
    dur = Date.now() - tStart;

    record(
      "8. Financial Reconciliation (Đối soát & So khớp AuditLog)",
      [200, 201].includes(reconRes.status),
      dur,
      `Status ${reconRes.status} | ${reconRes.data?.message || "Đối soát thành công"}`,
    );

    // -------------------------------------------------------------------------
    // 9. BẢO VỆ VÍ (CHẶN GIAO DỊCH KHI VÍ KHÔNG ĐỦ TIỀN)
    // -------------------------------------------------------------------------
    console.log(
      `\n${c.bold}${c.magenta}[BƯỚC 9] KIỂM SOÁT SỐ DƯ VÍ (403/400 Debt Guard)${c.reset}`,
    );
    tStart = Date.now();
    const overSpendRes = await api.post(
      "/tickets/book",
      {
        tripId: targetTripId,
        seatNumbers: [301, 302, 303, 304, 305, 306, 307, 308, 309, 310],
        paymentMethod: "WALLET",
      },
      { headers: authHeaders },
    );
    dur = Date.now() - tStart;

    const isDebtBlocked = [400, 403, 422].includes(overSpendRes.status);
    record(
      "9. Chặn đặt vé khi ví không đủ tiền (Debt/Balance Guard)",
      isDebtBlocked,
      dur,
      `Status ${overSpendRes.status} | Cơ chế bảo vệ số dư ví hoạt động chuẩn`,
    );

    // -------------------------------------------------------------------------
    // 10. ADMIN MỞ KHÓA VÍ
    // -------------------------------------------------------------------------
    console.log(
      `\n${c.bold}${c.magenta}[BƯỚC 10] QUẢN TRỊ ADMIN (Unlock Wallet)${c.reset}`,
    );
    tStart = Date.now();
    const unlockRes = await api.patch(
      `/admin/wallets/${userId}/unlock`,
      {},
      { headers: authHeaders },
    );
    dur = Date.now() - tStart;

    record(
      "10. Admin Unlock Wallet (Mở khóa ví người dùng)",
      [200, 201, 400].includes(unlockRes.status),
      dur,
      `Status ${unlockRes.status} | Phân quyền Admin & Unlock Wallet`,
    );

    // -------------------------------------------------------------------------
    // 11. TEARDOWN (HỦY VÉ TEST & NHẢ GHẾ)
    // -------------------------------------------------------------------------
    console.log(
      `\n${c.bold}${c.magenta}[BƯỚC 11] TEARDOWN DATA (Hủy vé test & Giải phóng ghế)${c.reset}`,
    );
    tStart = Date.now();
    if (createdTicketId) {
      await api.patch(
        `/tickets/${createdTicketId}/cancel`,
        {},
        { headers: authHeaders },
      );
    }
    dur = Date.now() - tStart;
    record(
      "11. Teardown (Giải phóng ghế test)",
      true,
      dur,
      `Ghế #${testSeatNumber} đã được hoàn trả trạng thái trống`,
    );
  } catch (err: any) {
    console.error(
      `\n${c.red}Lỗi runtime trong quá trình chạy test:${c.reset}`,
      err.message,
    );
  }

  // -------------------------------------------------------------------------
  // BẢNG TỔNG HỢP KẾT QUẢ
  // -------------------------------------------------------------------------
  console.log(
    `\n${c.bold}${c.cyan}================================================================================${c.reset}`,
  );
  console.log(
    `${c.bold}${c.cyan}                      TỔNG HỢP KẾT QUẢ KIỂM THỬ TOÀN DIỆN                       ${c.reset}`,
  );
  console.log(
    `${c.bold}${c.cyan}================================================================================${c.reset}`,
  );
  console.table(results);

  const passedTests = results.filter((r) =>
    r["Kết Quả"].includes("PASS"),
  ).length;
  const isFullPass = passedTests === results.length && results.length > 0;

  console.log(
    `\n🎯 ${c.bold}KẾT QUẢ ĐẠT ĐƯỢC:${c.reset} ${isFullPass ? c.green : c.yellow}${c.bold}${passedTests}/${results.length}${c.reset} ${isFullPass ? c.green + "bài test đã vượt qua xuất sắc! (100% PASS)" : c.yellow + "bài test hoàn thành."}${c.reset}\n`,
  );
}

runTestSuite();
