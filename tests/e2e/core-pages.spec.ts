import { expect, test } from "@playwright/test";

test("ホーム画面を表示できる", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "今日のInstagram運用を確認" })).toBeVisible();
});

test("トークン管理画面を表示できる", async ({ page }) => {
  await page.goto("/token-management");
  await expect(page.getByRole("heading", { name: "トークン管理" })).toBeVisible();
  await expect(page.getByRole("button", { name: "今すぐ状態確認" })).toBeVisible();
});

test("ヘルスチェックAPIが応答する", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
  await expect(response.json()).resolves.toMatchObject({ ok: true });
});
