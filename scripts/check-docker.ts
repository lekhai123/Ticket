// scripts/check-docker.js
const { execSync } = require("child_process");

// Bỏ qua nếu đang chạy trên Vercel hoặc CI/CD
if (process.env.VERCEL || process.env.CI) {
  process.exit(0);
}

console.log("🔍 [NexusTicket] Đang kiểm tra môi trường Docker...");

try {
  execSync("docker info", { stdio: "ignore" });
} catch (error) {
  console.error("\n❌ [CHẶN KHỞI ĐỘNG]: Máy của bạn chưa bật Docker!");
  console.error(
    '👉 Bắt buộc phải mở Docker Desktop (hoặc chạy "sudo service docker start" trên WSL/Linux) trước khi gõ npm run dev.\n',
  );
  process.exit(1);
}

try {
  const running = execSync('docker ps --format "{{.Names}}"').toString();

  if (
    !running.includes("nexusticket_postgres") ||
    !running.includes("nexusticket_redis")
  ) {
    console.log(
      '⚡ Container chưa bật. Đang tự động chạy "docker compose up -d"...',
    );
    execSync("docker compose up -d", { stdio: "inherit" });
    console.log(
      "✅ Đã bật PostgreSQL (pgvector), Redis và AI Service thành công!",
    );
  } else {
    console.log("✅ Môi trường Docker Local đã sẵn sàng!");
  }
} catch (error) {
  console.error("❌ Lỗi khi khởi động Docker Compose:", error.message);
  process.exit(1);
}
// scripts/check-docker.js
const { execSync } = require('child_process');

// Bỏ qua nếu đang chạy trên Vercel hoặc CI/CD
if (process.env.VERCEL || process.env.CI) {
  process.exit(0);
}

console.log('🔍 [NexusTicket] Đang kiểm tra môi trường Docker...');

try {
  execSync('docker info', { stdio: 'ignore' });
} catch (error) {
  console.error('\n❌ [CHẶN KHỞI ĐỘNG]: Máy của bạn chưa bật Docker!');
  console.error('👉 Bắt buộc phải mở Docker Desktop (hoặc chạy "sudo service docker start" trên WSL/Linux) trước khi gõ npm run dev.\n');
  process.exit(1);
}

try {
  const running = execSync('docker ps --format "{{.Names}}"').toString();

  if (!running.includes('nexusticket_postgres') || !running.includes('nexusticket_redis')) {
    console.log('⚡ Container chưa bật. Đang tự động chạy "docker compose up -d"...');
    execSync('docker compose up -d', { stdio: 'inherit' });
    console.log('✅ Đã bật PostgreSQL (pgvector), Redis và AI Service thành công!');
  } else {
    console.log('✅ Môi trường Docker Local đã sẵn sàng!');
  }
} catch (error) {
  console.error('❌ Lỗi khi khởi động Docker Compose:', error.message);
  process.exit(1);
}