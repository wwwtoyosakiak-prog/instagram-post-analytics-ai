import { AiAnalysisRecord, ImprovementTask, InstagramAccount, InstagramPost, MonthlyGoal, MonthlyReportRecord, PostCategory, PostType } from "@/lib/types";
import { getMetrics, postCategoryLabels, postTypeLabels, taskStatusLabels } from "@/lib/metrics";

const headers = ["accountUsername", "date", "recordedDate", "url", "caption", "hashtags", "type", "category", "mediaCount", "likes", "comments", "saves", "shares", "views", "memo"];

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

export function parsePostsCsv(csv: string, accountIdByUsername: Record<string, string> = {}): InstagramPost[] {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const sourceHeaders = parseCsvLine(lines[0]).map((value) => value.trim());
  const index = Object.fromEntries(sourceHeaders.map((header, i) => [header, i]));
  return lines.slice(1).map((line, rowIndex) => {
    const cells = parseCsvLine(line);
    const value = (key: string) => cells[index[key]]?.trim() ?? "";
    const rawType = value("type");
    const type: PostType = rawType === "video" || rawType === "reel" || rawType === "carousel" ? rawType : "image";
    const rawCategory = value("category");
    const category: PostCategory = ["product", "howto", "campaign", "voice", "recruit", "store", "sale", "brand"].includes(rawCategory) ? rawCategory as PostCategory : "other";
    const now = new Date().toISOString();
    return {
      id: `csv-${Date.now()}-${rowIndex}`,
      createdAt: now,
      updatedAt: now,
      accountId: accountIdByUsername[value("accountUsername").replace(/^@/, "")],
      date: value("date"),
      recordedDate: value("recordedDate") || new Date().toISOString().slice(0, 10),
      url: value("url"),
      caption: value("caption"),
      hashtags: value("hashtags"),
      type,
      category,
      mediaCount: Number(value("mediaCount")) || 1,
      likes: Number(value("likes")) || 0,
      comments: Number(value("comments")) || 0,
      saves: Number(value("saves")) || 0,
      shares: Number(value("shares")) || 0,
      views: Number(value("views")) || 0,
      memo: value("memo")
    };
  });
}

export const csvTemplate = `${headers.join(",")}
ozops_outdoor,2026-05-01,2026-05-02,https://www.instagram.com/p/example/,"軽量焚き火ギアの紹介","#アウトドアギア #キャンプ道具",reel,product,1,438,28,96,42,12800,"動画冒頭で使用シーンを見せた"`;

function escapeCsv(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function createCsv(rows: unknown[][]) {
  return `\uFEFF${rows.map((row) => row.map(escapeCsv).join(",")).join("\n")}`;
}

export function exportAccountsCsv(accounts: InstagramAccount[]) {
  return createCsv([
    ["id", "accountName", "username", "profileUrl", "industry", "targetAudience", "goal", "memo", "createdAt", "updatedAt"],
    ...accounts.map((account) => [
      account.id,
      account.name,
      account.username,
      account.profileUrl,
      account.industry,
      account.targetAudience,
      account.goal,
      account.memo,
      account.createdAt,
      account.updatedAt
    ])
  ]);
}

export function exportPostsCsv(posts: InstagramPost[], accountNameById: Record<string, string> = {}) {
  return createCsv([
    [
      "id",
      "accountId",
      "accountName",
      "date",
      "recordedDate",
      "url",
      "caption",
      "hashtags",
      "type",
      "typeLabel",
      "category",
      "categoryLabel",
      "mediaCount",
      "likes",
      "comments",
      "saves",
      "shares",
      "views",
      "engagement",
      "engagementRate",
      "saveRate",
      "commentRate",
      "memo",
      "hasScreenshot",
      "createdAt",
      "updatedAt"
    ],
    ...posts.map((post) => {
      const metrics = getMetrics(post);
      return [
        post.id,
        post.accountId ?? "",
        post.accountId ? accountNameById[post.accountId] ?? "" : "",
        post.date,
        post.recordedDate,
        post.url,
        post.caption,
        post.hashtags,
        post.type,
        postTypeLabels[post.type],
        post.category ?? "other",
        postCategoryLabels[post.category ?? "other"],
        post.mediaCount,
        post.likes,
        post.comments,
        post.saves,
        post.shares,
        post.views,
        metrics.engagement,
        metrics.engagementRate.toFixed(2),
        metrics.saveRate.toFixed(2),
        metrics.commentRate.toFixed(2),
        post.memo,
        post.screenshot ? "yes" : "no",
        post.createdAt,
        post.updatedAt
      ];
    })
  ]);
}

export function exportAnalysesCsv(analyses: AiAnalysisRecord[], postById: Record<string, InstagramPost> = {}) {
  return createCsv([
    [
      "id",
      "postId",
      "postDate",
      "postCategory",
      "score",
      "scoreDelta",
      "firstImpression",
      "imageMessage",
      "captionClarity",
      "strengths",
      "weaknesses",
      "reason",
      "improvements",
      "nextIdeas",
      "hashtags",
      "createdAt"
    ],
    ...analyses.map((analysis) => {
      const post = postById[analysis.postId];
      return [
        analysis.id,
        analysis.postId,
        post?.date ?? "",
        post ? postCategoryLabels[post.category ?? "other"] : "",
        analysis.score,
        analysis.scoreDelta ?? "",
        analysis.firstImpression,
        analysis.imageMessage,
        analysis.captionClarity,
        analysis.strengths,
        analysis.weaknesses,
        analysis.reason,
        analysis.improvements.join(" / "),
        analysis.nextIdeas.join(" / "),
        analysis.hashtags.join(" "),
        analysis.createdAt
      ];
    })
  ]);
}

export function exportMonthlyReportsCsv(reports: MonthlyReportRecord[]) {
  return createCsv([
    [
      "id",
      "month",
      "accountId",
      "accountName",
      "totalViews",
      "averageLikes",
      "averageSaves",
      "averageEngagementRate",
      "topPostIds",
      "needsWorkPostIds",
      "summary",
      "nextMonthPolicy",
      "createdAt",
      "updatedAt"
    ],
    ...reports.map((report) => [
      report.id,
      report.month,
      report.accountId ?? "",
      report.accountName,
      report.totalViews,
      report.averageLikes.toFixed(2),
      report.averageSaves.toFixed(2),
      report.averageEngagementRate.toFixed(2),
      report.topPosts.map((post) => post.id).join(" / "),
      report.needsWorkPosts.map((post) => post.id).join(" / "),
      report.summary,
      report.nextMonthPolicy.join(" / "),
      report.createdAt,
      report.updatedAt
    ])
  ]);
}

export function exportTasksCsv(tasks: ImprovementTask[], postById: Record<string, InstagramPost> = {}) {
  return createCsv([
    [
      "id",
      "postId",
      "postDate",
      "postCategory",
      "analysisId",
      "title",
      "status",
      "statusLabel",
      "assignee",
      "dueDate",
      "memo",
      "completedAt",
      "createdAt",
      "updatedAt"
    ],
    ...tasks.map((task) => {
      const post = task.postId ? postById[task.postId] : undefined;
      return [
        task.id,
        task.postId ?? "",
        post?.date ?? "",
        post ? postCategoryLabels[post.category ?? "other"] : "",
        task.analysisId ?? "",
        task.title,
        task.status,
        taskStatusLabels[task.status],
        task.assignee,
        task.dueDate,
        task.memo,
        task.completedAt ?? "",
        task.createdAt,
        task.updatedAt
      ];
    })
  ]);
}

export function exportGoalsCsv(goals: MonthlyGoal[], accountNameById: Record<string, string> = {}) {
  return createCsv([
    [
      "id",
      "month",
      "accountId",
      "accountName",
      "targetPosts",
      "targetViews",
      "targetSaves",
      "targetSaveRate",
      "targetEngagementRate",
      "memo",
      "createdAt",
      "updatedAt"
    ],
    ...goals.map((goal) => [
      goal.id,
      goal.month,
      goal.accountId ?? "",
      goal.accountId ? accountNameById[goal.accountId] ?? "" : "すべて",
      goal.targetPosts,
      goal.targetViews,
      goal.targetSaves,
      goal.targetSaveRate,
      goal.targetEngagementRate,
      goal.memo,
      goal.createdAt,
      goal.updatedAt
    ])
  ]);
}
