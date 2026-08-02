import { expect, test, type Page } from "@playwright/test";

const fixturePosts = [
  {
    id: "post-image",
    accountId: "account-e2e",
    date: "2026-07-30",
    recordedDate: "2026-07-30",
    url: "https://www.instagram.com/p/image-test/",
    caption: "画像投稿のテスト",
    hashtags: "#画像",
    type: "image",
    mediaCount: 1,
    likes: 20,
    comments: 2,
    saves: 3,
    shares: 1,
    views: 200,
    memo: "",
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
  },
  {
    id: "post-video",
    accountId: "account-e2e",
    date: "2026-07-31",
    recordedDate: "2026-07-31",
    url: "https://www.instagram.com/reel/video-test/",
    caption: "動画投稿のテスト",
    hashtags: "#動画",
    type: "video",
    mediaCount: 1,
    likes: 50,
    comments: 5,
    saves: 10,
    shares: 2,
    views: 500,
    memo: "編集前メモ",
    createdAt: "2026-07-31T00:00:00.000Z",
    updatedAt: "2026-07-31T00:00:00.000Z",
  },
];

async function mockCoreData(page: Page) {
  await page.route("**/api/data/posts**", async (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON() as { id: string; post: Record<string, unknown> };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          post: {
            ...fixturePosts.find((post) => post.id === body.id),
            ...body.post,
            updatedAt: "2026-07-31T01:00:00.000Z",
          },
        }),
      });
      return;
    }
    await route.fulfill({ json: { posts: fixturePosts } });
  });
  await page.route("**/api/data/accounts**", (route) => route.fulfill({ json: { accounts: [] } }));
  await page.route("**/api/data/analyses**", (route) => route.fulfill({ json: { analyses: [] } }));
  await page.route("**/api/data/insights**", (route) => route.fulfill({ json: { insight: null, insights: [] } }));
  await page.route("**/api/data/sync-runs**", (route) => route.fulfill({ json: { syncRuns: [] } }));
  await page.route("**/api/instagram/media**", (route) => route.fulfill({ json: { data: [] } }));
  await page.route("**/api/instagram/dashboard**", (route) =>
    route.fulfill({ json: { configured: false, account: null, account_insights_trend: [] } }),
  );
  await page.route("**/api/instagram/token/status", (route) =>
    route.fulfill({ json: { status: "active" } }),
  );
  await page.route("**/api/instagram/setup-status", (route) =>
    route.fulfill({ json: {
      oauthConfigured: true,
      connectionReady: false,
      databaseReady: true,
      deletionTableReady: true,
      duplicateProtectionReady: true,
    } }),
  );
}

test.beforeEach(async ({ page }) => {
  await mockCoreData(page);
});

test("分析結果を投稿ごとではなく一度に読み込む", async ({ page }) => {
  let analysisRequestCount = 0;
  await page.unroute("**/api/data/analyses**");
  await page.route("**/api/data/analyses**", (route) => {
    analysisRequestCount += 1;
    return route.fulfill({ json: { analyses: [] } });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "3ステップで確認" })).toBeVisible();
  await expect.poll(() => analysisRequestCount).toBe(1);
});

test("投稿がないときに初期設定の順番を案内する", async ({ page }) => {
  await page.unroute("**/api/data/posts**");
  await page.route("**/api/data/posts**", (route) => route.fulfill({ json: { posts: [] } }));
  await page.route("**/api/instagram/token/status", (route) =>
    route.fulfill({ json: { status: "missing" } }),
  );

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Instagramのデータを表示する準備" })).toBeVisible();
  await expect(page.getByText("Instagramを接続", { exact: true })).toBeVisible();
  await expect(page.getByText("最初のデータを取得", { exact: true })).toBeVisible();
  await expect(page.getByText("投稿結果を確認", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "接続を始める" })).toHaveAttribute("href", "/token-management");
});

test("データがない主要画面から次の操作へ進める", async ({ page }) => {
  await page.unroute("**/api/data/posts**");
  await page.route("**/api/data/posts**", (route) => route.fulfill({ json: { posts: [] } }));

  await page.goto("/posts");
  await expect(page.getByRole("heading", { name: "投稿データはまだありません" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Instagramデータを取得" })).toHaveAttribute("href", "/dashboard");

  await page.goto("/calendar");
  await expect(page.getByRole("heading", { name: /の投稿はまだありません/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Instagramデータを取得" })).toHaveAttribute("href", "/dashboard");

  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "レポートを作るための投稿がありません" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Instagramデータを取得" })).toHaveAttribute("href", "/dashboard");

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "分析する投稿データはまだありません" })).toBeVisible();
});

const menuDestinations = [
  { link: "投稿", path: "/posts", heading: "投稿一覧" },
  { link: "分析", path: "/dashboard", heading: "ダッシュボード" },
  { link: "レポート", path: "/reports", heading: "月次レポート" },
  { link: "カレンダー", path: "/calendar", heading: "投稿カレンダー" },
  { link: "プロフィール", path: "/accounts", heading: "プロフィール" },
  { link: "Instagram連携", path: "/token-management", heading: "トークン管理" },
];

for (const destination of menuDestinations) {
  test(`メインメニューから${destination.link}へ移動できる`, async ({ page, isMobile }) => {
    await page.goto("/");
    const isBottomDestination = ["投稿", "分析", "レポート", "プロフィール"].includes(destination.link);
    if (isMobile && isBottomDestination) {
      await page.getByRole("navigation", { name: "スマートフォン用メニュー" })
        .getByRole("link", { name: destination.link, exact: true })
        .click();
    } else if (isMobile) {
      await page.getByRole("link", { name: new RegExp(`^${destination.link}`) }).click();
    } else {
      await page.getByRole("navigation", { name: "メインメニュー" })
        .getByRole("link", { name: destination.link, exact: true })
        .click();
    }
    await expect(page).toHaveURL(new RegExp(`${destination.path}$`));
    await expect(page.getByRole("heading", { name: destination.heading, exact: true })).toBeVisible();
  });
}

test("表示するアカウントを全画面共通で切り替えられる", async ({ page }) => {
  await page.unroute("**/api/data/accounts**");
  await page.route("**/api/data/accounts**", (route) => route.fulfill({ json: { accounts: [
    { id: "account-e2e", name: "メイン", username: "main" },
    { id: "account-second", name: "サブ", username: "sub" },
  ] } }));

  await page.goto("/");
  await page.getByLabel("表示するInstagramアカウント").selectOption("account-second");
  await expect(page.getByLabel("表示するInstagramアカウント")).toHaveValue("account-second");
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("instagram-ai-selected-account-v1"))).toBe("account-second");
});

test("プロフィールからデータを書き出し・復元できる", async ({ page }) => {
  await page.goto("/accounts");
  await expect(page.getByRole("heading", { name: "データを保護" })).toBeVisible();
  await expect(page.getByRole("button", { name: "データを書き出す" })).toBeVisible();
  await expect(page.getByText("データを復元", { exact: true })).toBeVisible();
});

test("共通トークンがあってもユーザー別Instagram連携を開始できる", async ({ page }) => {
  await page.goto("/token-management");

  await expect(page.getByRole("link", { name: "Instagramと連携", exact: true })).toHaveAttribute("href", "/api/instagram/oauth/start");
  await expect(page.getByText("共通トークンは利用できますが、このユーザー専用のInstagram連携はまだ完了していません。")).toBeVisible();
  await expect(page.getByRole("button", { name: "連携を解除" })).toHaveCount(0);
});

test("投稿タイプで一覧を絞り込める", async ({ page }) => {
  await page.goto("/posts");
  await expect(page.getByText("画像投稿のテスト")).toBeVisible();
  await expect(page.getByText("動画投稿のテスト")).toBeVisible();

  await page.getByLabel("投稿タイプ").selectOption("video");

  await expect(page.getByText("動画投稿のテスト")).toBeVisible();
  await expect(page.getByText("画像投稿のテスト")).toBeHidden();
  await expect(page.getByText("1 件", { exact: true })).toBeVisible();
});

test("カレンダーとレポートの期間を表示名から操作できる", async ({ page }) => {
  await page.goto("/calendar");
  await page.getByLabel("表示月").fill("2026-06");
  await expect(page.getByLabel("表示月")).toHaveValue("2026-06");

  await page.goto("/reports");
  await expect(page.getByLabel("対象月")).toHaveValue("2026-07");
  await page.getByLabel("対象月").fill("2026-05");
  await page.getByLabel("対象年度").fill("2025");
  await page.getByLabel("年度の開始月").selectOption("1");
  await expect(page.getByLabel("対象月")).toHaveValue("2026-05");
  await expect(page.getByLabel("対象年度")).toHaveValue("2025");
  await expect(page.getByLabel("年度の開始月")).toHaveValue("1");
});

test("カレンダーの読み込み完了後も選択した月を維持する", async ({ page }) => {
  await page.unroute("**/api/data/posts**");
  await page.route("**/api/data/posts**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({ json: { posts: fixturePosts } });
  });

  const postsRequest = page.waitForRequest("**/api/data/posts**");
  const postsResponse = page.waitForResponse("**/api/data/posts**");
  await page.goto("/calendar");
  await postsRequest;
  await page.getByLabel("表示月").fill("2026-06");
  await postsResponse;

  await expect(page.getByLabel("表示月")).toHaveValue("2026-06");
  await expect(page.getByRole("heading", { name: "2026年6月", exact: true })).toBeVisible();
});

test("投稿詳細から編集して保存できる", async ({ page }) => {
  await page.goto("/posts/detail?id=post-video");
  await expect(page.getByRole("heading", { name: "投稿詳細・AI分析", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "編集", exact: true }).click();
  await expect(page).toHaveURL(/\/posts\/edit\?id=post-video$/);
  await expect(page.getByRole("heading", { name: "投稿編集", exact: true })).toBeVisible();

  for (const field of [
    "対象アカウント",
    "投稿日",
    "データ登録日",
    "投稿タイプ",
    "投稿画像・動画の枚数",
    "投稿URL",
    "ハッシュタグ",
    "いいね数",
    "コメント数",
    "保存数",
    "シェア数",
    "表示数 / views",
    "メモ",
    "投稿画像スクショ",
  ]) {
    await expect(page.getByLabel(field, { exact: true })).toBeVisible();
  }

  await page.getByLabel("投稿コメント").fill("編集後の動画投稿");
  await page.getByRole("button", { name: "変更を保存", exact: true }).click();

  await expect(page).toHaveURL(/\/posts\/detail\?id=post-video$/);
  await expect(page.getByRole("heading", { name: "投稿詳細・AI分析", exact: true })).toBeVisible();
});

test("Instagram同期の失敗理由を表示する", async ({ page }) => {
  await page.route("**/api/instagram/full-sync", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, status: "failed", error: "Instagram接続を確認してください。" }),
    }),
  );
  await page.goto("/dashboard");

  await page.getByRole("button", { name: "Instagramデータを同期", exact: true }).click();

  await expect(page.getByText("Instagramのデータを取得できませんでした。接続状態を確認して、もう一度お試しください。", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "もう一度取得", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Instagramデータを同期", exact: true })).toBeEnabled();
});
