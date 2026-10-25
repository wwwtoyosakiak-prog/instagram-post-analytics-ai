/**
 * 毎日の自動投稿（リール）用のヘルパー
 * - Supabase Storage に動画と投稿履歴を保存
 * - OpenAI で「今日の投稿内容」を企画
 * - Instagram Graph API でリールを公開
 */

import { getInstagramGraphConfig, createInstagramGraphUrl } from "@/lib/instagram-graph";
import { requireSupabaseServerClient } from "@/lib/supabase-server";
import { ApiRequestError, fetchJsonWithTimeout, readOpenAiOutput, readUpstreamError } from "@/lib/server-api";

export const AUTOPOST_BUCKET = process.env.AUTOPOST_BUCKET || "autopost";
const HISTORY_PATH = "history.json";
const HISTORY_LIMIT = 60;

export const AUTOPOST_STYLES = ["pop", "kraft", "dark", "quiz", "sdgs", "story"] as const;
export type AutopostStyle = (typeof AUTOPOST_STYLES)[number];

export type AutopostPhoto = { id: string; tags: string[] };
export type AutopostQuiz = { id: string; q: string };

export type AutopostPlan = {
  style: AutopostStyle;
  theme: string;
  lines: string[];
  photos: string[];
  quizId: string | null;
  tomorrowTeaser: string;
  caption: string;
  hashtags: string[];
};

export type AutopostHistoryEntry = {
  date: string;
  theme: string;
  style: string;
  photos: string[];
  caption: string;
  mediaId?: string;
  permalink?: string;
  source: "ai" | "queue" | "fallback";
};

// ── Storage ────────────────────────────────────────────────

async function ensureBucket() {
  const storage = requireSupabaseServerClient().storage;
  const { data } = await storage.getBucket(AUTOPOST_BUCKET);
  if (data) return;
  const { error } = await storage.createBucket(AUTOPOST_BUCKET, { public: false });
  if (error && !/already exists|duplicate/i.test(error.message)) throw new ApiRequestError(`Storageバケットを作成できませんでした: ${error.message}`, 502);
}

export async function readAutopostHistory(): Promise<AutopostHistoryEntry[]> {
  await ensureBucket();
  const { data, error } = await requireSupabaseServerClient().storage.from(AUTOPOST_BUCKET).download(HISTORY_PATH);
  if (error || !data) return [];
  try {
    const parsed = JSON.parse(await data.text());
    return Array.isArray(parsed) ? parsed as AutopostHistoryEntry[] : [];
  } catch {
    return [];
  }
}

export async function appendAutopostHistory(entry: AutopostHistoryEntry) {
  const history = await readAutopostHistory();
  const next = [...history.filter((item) => !(item.date === entry.date && item.mediaId === entry.mediaId)), entry].slice(-HISTORY_LIMIT);
  const body = new Blob([JSON.stringify(next, null, 2)], { type: "application/json" });
  const { error } = await requireSupabaseServerClient().storage.from(AUTOPOST_BUCKET).upload(HISTORY_PATH, body, { upsert: true, contentType: "application/json" });
  if (error) throw new ApiRequestError(`投稿履歴を保存できませんでした: ${error.message}`, 502);
  return next;
}

function assertVideoPath(path: string) {
  if (!/^videos\/[0-9]{4}-[0-9]{2}-[0-9]{2}[a-z0-9-]*\.mp4$/.test(path)) throw new ApiRequestError("動画パスの形式が正しくありません。", 400);
}

export async function createVideoUploadUrl(path: string) {
  assertVideoPath(path);
  await ensureBucket();
  const { data, error } = await requireSupabaseServerClient().storage.from(AUTOPOST_BUCKET).createSignedUploadUrl(path, { upsert: true });
  if (error || !data) throw new ApiRequestError(`アップロードURLを作成できませんでした: ${error?.message ?? "unknown"}`, 502);
  return { uploadUrl: data.signedUrl, path: data.path };
}

async function createVideoDownloadUrl(path: string) {
  assertVideoPath(path);
  const { data, error } = await requireSupabaseServerClient().storage.from(AUTOPOST_BUCKET).createSignedUrl(path, 60 * 60 * 3);
  if (error || !data) throw new ApiRequestError(`動画URLを作成できませんでした: ${error?.message ?? "unknown"}`, 502);
  return data.signedUrl;
}

// ── 企画（OpenAI） ─────────────────────────────────────────

const planSchema = {
  type: "object",
  additionalProperties: false,
  required: ["style", "theme", "lines", "photos", "quizId", "tomorrowTeaser", "caption", "hashtags"],
  properties: {
    style: { type: "string", enum: [...AUTOPOST_STYLES] },
    theme: { type: "string", description: "動画のテーマ。ひらがな多めで12文字以内" },
    lines: { type: "array", items: { type: "string" }, description: "写真に重ねる短いテロップ。各10文字以内、3〜4個" },
    photos: { type: "array", items: { type: "string" }, description: "使う写真ID。4〜6枚" },
    quizId: { type: ["string", "null"], description: "style=quizのときだけ、クイズ一覧のIDを1つ。それ以外はnull" },
    tomorrowTeaser: { type: "string", description: "あしたの予告。10文字以内" },
    caption: { type: "string", description: "Instagramキャプション本文。ハッシュタグは含めない。120文字以内、絵文字1〜3個" },
    hashtags: { type: "array", items: { type: "string" }, description: "#なしのハッシュタグ。3〜6個" },
  },
} as const;

const REQUIRED_TAGS = ["ペパポン", "新西ゼミ"];

function clip(value: unknown, max: number) {
  return typeof value === "string" ? Array.from(value.trim()).slice(0, max).join("") : "";
}

export function sanitizePlan(raw: unknown, photos: AutopostPhoto[], quizIds: string[] = []): AutopostPlan {
  if (!raw || typeof raw !== "object") throw new ApiRequestError("企画データが正しくありません。", 502);
  const value = raw as Record<string, unknown>;
  const ids = new Set(photos.map((photo) => photo.id));
  let style = AUTOPOST_STYLES.includes(value.style as AutopostStyle) ? value.style as AutopostStyle : "pop";
  const quizId = typeof value.quizId === "string" && quizIds.includes(value.quizId) ? value.quizId : null;
  if (style === "quiz" && !quizId) style = "pop";
  const chosen = (Array.isArray(value.photos) ? value.photos : []).filter((id): id is string => typeof id === "string" && ids.has(id));
  const uniquePhotos = [...new Set(chosen)].slice(0, 6);
  for (const photo of photos) {
    if (uniquePhotos.length >= 4) break;
    if (!uniquePhotos.includes(photo.id)) uniquePhotos.push(photo.id);
  }
  const lines = (Array.isArray(value.lines) ? value.lines : []).map((line) => clip(line, 10)).filter(Boolean).slice(0, 4);
  const hashtags = [...new Set([
    ...REQUIRED_TAGS,
    ...(Array.isArray(value.hashtags) ? value.hashtags : []).map((tag) => clip(tag, 20).replace(/^#/, "").replace(/\s/g, "")).filter(Boolean),
  ])].slice(0, 8);
  return {
    style,
    theme: clip(value.theme, 12) || "だんボールガチャ",
    lines: lines.length ? lines : ["つくって", "かざって", "まわそう！"],
    photos: uniquePhotos,
    quizId: style === "quiz" ? quizId : null,
    tomorrowTeaser: clip(value.tomorrowTeaser, 10) || "おたのしみに",
    caption: clip(value.caption, 300),
    hashtags,
  };
}

export async function planTodaysPost(input: { date: string; weekday: string; photos: AutopostPhoto[]; ideas: string[]; quizzes: AutopostQuiz[] }) {
  if (!process.env.OPENAI_API_KEY) throw new ApiRequestError("OPENAI_API_KEY が設定されていません。", 503);
  const history = await readAutopostHistory();
  const recent = history.slice(-14);
  const prompt = `あなたは「だんボールガチャ ペパポン」（段ボールでつくるガチャガチャ。株式会社ペパポン×多摩大学 新西ゼミの産学連携）のInstagram運用担当です。
今日 ${input.date}（${input.weekday}）の朝7:30に投稿する10秒の縦型リールの内容を企画してください。

ルール:
- 対象は子ども連れの家族・先生。やさしい日本語、ひらがな多め。
- 実際の素材（写真）にあるものだけを話題にする。架空のイベント日程・価格・販売情報は書かない。
- 直近の投稿とテーマ・スタイル・写真が重ならないようにする。同じstyleは2日連続にしない。
- style: pop=元気なカラフル / kraft=段ボールの手づくり感 / dark=黒×クラフトのかっこいい作品紹介 / quiz=クイズ / sdgs=資源・リサイクル / story=絵本風のふりかえり
- 曜日の雰囲気も少し意識する（例: 月曜は元気に、週末はおでかけ・工作向け）。

テーマのヒント（使っても使わなくてもよい）:
${input.ideas.map((idea) => `- ${idea}`).join("\n")}

クイズ一覧（style=quizのときはここから1つ選ぶ。内容は変えない）:
${input.quizzes.length ? input.quizzes.map((quiz) => `- ${quiz.id}: ${quiz.q}`).join("\n") : "- なし（quizは使わない）"}

使える写真（ID: 内容タグ）:
${input.photos.map((photo) => `- ${photo.id}: ${photo.tags.join("、")}`).join("\n")}

直近の投稿:
${recent.length ? recent.map((item) => `- ${item.date} style=${item.style} theme=${item.theme} photos=${item.photos.join(",")}`).join("\n") : "- まだありません"}`;

  const { response, data } = await fetchJsonWithTimeout("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      input: prompt,
      text: { format: { type: "json_schema", name: "autopost_plan", strict: true, schema: planSchema } },
    }),
  }, 45_000);
  if (!response.ok) throw new ApiRequestError(readUpstreamError(data, "OpenAI APIの呼び出しに失敗しました。"), 502);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readOpenAiOutput(data));
  } catch {
    throw new ApiRequestError("企画データを読み取れませんでした。", 502);
  }
  return { plan: sanitizePlan(parsed, input.photos, input.quizzes.map((quiz) => quiz.id)), recent };
}

// ── 公開（Instagram Graph API） ─────────────────────────────

type GraphResult = { id?: string; status_code?: string; status?: string; permalink?: string; error?: { message?: string; code?: number } };

async function graph(path: string, init: RequestInit = {}, params: Record<string, string> = {}) {
  const config = await getInstagramGraphConfig("owner");
  const url = createInstagramGraphUrl(config, path.replace("{account}", config.accountResource));
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("access_token", config.accessToken);
  const { response, data } = await fetchJsonWithTimeout<GraphResult>(url.toString(), init, 50_000);
  if (!response.ok || data.error) {
    const message = data.error?.message ?? `Graph API error (${response.status})`;
    const hint = data.error?.code === 10 || /permission/i.test(message)
      ? "（instagram_business_content_publish 権限がありません。アプリの「Instagram連携」からもう一度連携してください）"
      : "";
    throw new ApiRequestError(`${message}${hint}`, response.status >= 400 && response.status < 500 ? 400 : 502);
  }
  return data;
}

export async function createReelContainer(path: string, caption: string) {
  const videoUrl = await createVideoDownloadUrl(path);
  const body = new URLSearchParams({ media_type: "REELS", video_url: videoUrl, caption, share_to_feed: "true" });
  const data = await graph("{account}/media", { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  if (!data.id) throw new ApiRequestError("メディアコンテナIDを取得できませんでした。", 502);
  return data.id;
}

export async function readContainerStatus(containerId: string) {
  if (!/^[0-9]+$/.test(containerId)) throw new ApiRequestError("コンテナIDが正しくありません。", 400);
  const data = await graph(containerId, {}, { fields: "status_code,status" });
  return { statusCode: data.status_code ?? "UNKNOWN", status: data.status ?? "" };
}

export async function publishContainer(containerId: string) {
  if (!/^[0-9]+$/.test(containerId)) throw new ApiRequestError("コンテナIDが正しくありません。", 400);
  const published = await graph("{account}/media_publish", {
    method: "POST",
    body: new URLSearchParams({ creation_id: containerId }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  if (!published.id) throw new ApiRequestError("公開後のメディアIDを取得できませんでした。", 502);
  let permalink: string | undefined;
  try {
    permalink = (await graph(published.id, {}, { fields: "permalink" })).permalink;
  } catch {
    permalink = undefined;
  }
  return { mediaId: published.id, permalink };
}
