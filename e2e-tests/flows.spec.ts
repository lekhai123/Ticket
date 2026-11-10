import { test, expect } from "@playwright/test";

const TEST_EMAIL = process.env.userTest;
const TEST_PASSWORD = process.env.passUserTest;

test.describe("Luồng trải nghiệm người dùng (E2E)", () => {
  test.beforeEach(async ({ page }) => {
    page.on("dialog", async (dialog) => {
      console.log(`[Hộp thoại hệ thống]: ${dialog.message()}`);
      await dialog.accept();
    });
  });

  test("Đăng nhập, Tìm kiếm, Mua vé và Hủy vé thành công", async ({ page }) => {
    await page.goto("/auth/login");

    await page
      .locator('input[placeholder="admin@nexusticket.com"]')
      .fill(TEST_EMAIL);
    // Điền Mật khẩu
    await page.locator('input[type="password"]').fill(TEST_PASSWORD);

    await page.locator('button[type="submit"]:has-text("Đăng nhập")').click();

    await page.waitForURL("**/");
    console.log("Bước 1: Đăng nhập thành công");

    const searchInput = page.locator('input[placeholder*="Ví dụ:"]');
    await searchInput.fill("Đà Lạt");

    await page.locator('button:has-text("Tìm kiếm")').click();

    await page.waitForTimeout(2000);
    console.log(" Bước 2: Đã tìm kiếm chuyến xe");
    const chooseSeatBtn = page.locator('button:has-text("Chọn ghế")').first();
    await expect(chooseSeatBtn).toBeEnabled();
    await chooseSeatBtn.click();

    await page.waitForURL("**/booking/**");

    const availableSeatBtn = page
      .locator("button:not([disabled])")
      .filter({ hasText: /^A\d+$/ })
      .first();
    await expect(availableSeatBtn).toBeVisible({ timeout: 5000 });

    const seatText = await availableSeatBtn.textContent();
    console.log(` Đang chọn ghế: ${seatText}`);

    await availableSeatBtn.click();

    const payBtn = page.locator('button:has-text("Thanh toán bằng Ví")');
    await expect(payBtn).toBeEnabled();
    await payBtn.click();

    await page.waitForURL("**/customer/wallet", { timeout: 10000 });
    await page.waitForTimeout(2000);
    console.log(" Bước 3: Đã mua vé thành công bằng ví");

    await page.goto("/customer/profile");

    await page.locator('button:has-text("Vé của tôi")').click();

    await page.waitForTimeout(1500);

    const cancelBtn = page.locator('button:has-text("Hủy vé")').first();
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    await page.waitForTimeout(2000);

    const statusText = page.locator('span:has-text("Đã hủy vé")').first();
    await expect(statusText).toBeVisible();
    console.log(" Bước 4: Đã hủy vé và hoàn tiền thành công");
  });
});
