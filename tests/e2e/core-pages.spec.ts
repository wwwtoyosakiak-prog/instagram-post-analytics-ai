import { expect, test } from "@playwright/test";

const primaryPages = [
  { path: "/", heading: "今日、確認すること" },
  { path: "/posts", heading: "投稿一覧" },
  { path: "/dashboard", heading: "ダッシュボード" },
  { path: "/reports", heading: "月次レポート" },
  { path: "/calendar", heading: "投稿カレンダー" },
  { path: "/accounts", heading: "プロフィール" },
  { path: "/token-management", heading: "トークン管理" },
];

const retiredPagePaths = [
  "/ai-agent",
  "/ai-improvement-cycle",
  "/ai-improvement-suggestions",
  "/ai-learning",
  "/ai-manager",
  "/ai-manager-history",
  "/analysis",
  "/competitor-dashboard",
  "/growth-advisor",
  "/growth-history",
  "/growth-strategy",
  "/ig-dashboard",
  "/instagram-api",
  "/notification-automation",
  "/notifications",
  "/operation-consultant",
  "/post-kpis",
  "/post-plan-history",
  "/post-planner",
  "/post-retrospectives",
  "/weekly-operation-review",
  "/weekly-operation-review-ai",
  "/weekly-operation-review-ai-history",
  "/weekly-review-automation",
  "/weekly-review-automation-settings",
];

const retiredApiPaths = [
  "/api/ai-agent/run",
  "/api/ai-agent/runs",
  "/api/ai-improvement-cycles",
  "/api/ai-improvement-suggestions",
  "/api/ai-learning",
  "/api/ai-manager",
  "/api/ai-manager/history",
  "/api/ai-manager/tasks",
  "/api/ai-manager/weekly-review",
  "/api/ai-manager/weekly-review/ai",
  "/api/ai-manager/weekly-review/ai-history",
  "/api/analysis/reel",
  "/api/competitor-ai-analysis",
  "/api/competitor-posts",
  "/api/competitors",
  "/api/cron/generate-notifications",
  "/api/cron/weekly-operation-review",
  "/api/extract-screenshot",
  "/api/growth-history",
  "/api/growth-strategy",
  "/api/growth-strategy/ai",
  "/api/instagram/analyze",
  "/api/instagram/exchange-token",
  "/api/instagram/posts",
  "/api/notification-runs",
  "/api/notifications",
  "/api/notifications/generate",
  "/api/operation-consultant",
  "/api/post-kpis",
  "/api/post-planner",
  "/api/post-plans",
  "/api/post-retrospectives",
  "/api/post-schedules",
  "/api/test-openai",
  "/api/weekly-review-automation-runs",
  "/api/weekly-review-automation-settings",
];

for (const { path, heading } of primaryPages) {
  test(`${heading}画面を表示できる`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  });
}

test("カレンダーから投稿一覧へ移動できる", async ({ page }) => {
  await page.goto("/calendar");
  await page.getByRole("link", { name: "投稿一覧を見る" }).click();
  await expect(page).toHaveURL(/\/posts$/);
  await expect(page.getByRole("heading", { name: "投稿一覧" })).toBeVisible();
});

test("削除した旧ページを直接開けない", async ({ request }) => {
  for (const path of retiredPagePaths) {
    const response = await request.get(path);
    expect(response.status(), `${path} should return 404`).toBe(404);
  }
});

test("削除した旧APIを直接呼び出せない", async ({ request }) => {
  for (const path of retiredApiPaths) {
    const response = await request.get(path);
    expect(response.status(), `${path} should return 404`).toBe(404);
  }
});

test("ヘルスチェックAPIが応答する", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  await expect(response.json()).resolves.toMatchObject({ ok: true });
});
