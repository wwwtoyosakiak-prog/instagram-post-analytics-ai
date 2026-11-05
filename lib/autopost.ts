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

export const AUTOPOST_STYLES = ["pop", "kraft", "dark", "quiz", "sdgs", "story", "spotlight", "ranking", "zukan"] as const;
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
  commentPrompt: string;
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

/** 曜日ごとの連載。毎週同じ曜日に同じ企画が来るので、フォロワーが楽しみにしやすい。 */
export const AUTOPOST_SERIES: { name: string; style: AutopostStyle; guide: string }[] = [
  { name: "つくりかた ミニ講座", style: "kraft", guide: "組み立て・かざりつけの流れを順番に紹介。make_* や ws_hands / ws_help などの写真中心。lines は手順（例: いたを はずして / おって たてて / ゴムを かけたら / かんせい！）" },
  { name: "きょうの いちだい", style: "spotlight", guide: "作品を1〜2台だけ選び、虫めがねで細部を見るように紹介。photos は同じ作品を中心に2枚。lines はその作品の細部の見どころ（例: めだまが ぎょろっ / キラキラの テープ）" },
  { name: "ペパポン クイズ", style: "quiz", guide: "クイズ一覧から、直近で使っていないものを1つ選ぶ。キャプションは答えを書かず『こたえは動画で』と誘う" },
  { name: "推しガチャ ランキング", style: "ranking", guide: "作品写真を3枚。photos は 3位→2位→1位 の順。lines は photos と同じ順で各作品の推しポイントを3つ（優劣ではなく『推し』の理由）。キャプションも 🥉3位 → 🥈2位 → 🥇1位 の順で、それぞれの推しポイントを紹介" },
  { name: "ペパポン図鑑", style: "zukan", guide: "観察ノート風。作品3〜4枚の特徴を観察して lines に書く（例: さんかくの はな / ピンクの ほっぺ）。キャプションは『観察してわかったこと』の形で" },
  { name: "SDGs まめちしき", style: "sdgs", guide: "事実シートの範囲で SDGs・資源の豆知識を1つだけ深掘り。sdgs_* と作品写真を組み合わせる" },
  { name: "ワークショップ アルバム", style: "story", guide: "ws_* 写真中心に、ワークショップの1場面を思い出として。子どもたちの工夫や表情（顔は写っていない）を言葉で伝える" },
];

export function seriesForDate(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0=日
  return AUTOPOST_SERIES[(day + 6) % 7];
}

export function nextDate(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const FACT_SHEET = `- ペパポンは株式会社ペパポンの、だんボールでつくるガチャガチャ。だんボールの板を組み立て、ゴムをかけて完成させる。
- 多摩大学 新西ゼミとの産学連携。子ども向けワークショップを開き、多摩祭（2026年10月24日）でも展示した。
- ws_* や IMG_* の写真は子ども向けワークショップのもの（多摩祭の写真ではない）。
- ワークショップでは子どもたちがシール、ペン、クレヨン、色紙、めだまシール、キラキラテープなどでかざりつけをした。星形の穴とLEDで光る作品もある。
- カプセルはひとつずつ手づくり。SDGsの8番（働きがいも経済成長も）と12番（つくる責任つかう責任）に関わる。
- だんボールや新聞紙は分別して出せば資源として回収され、また紙やだんボールに生まれかわる（出し方は地域のルールによる）。
- 写真タグと事実シートにない材料・場面・使い方（例: 夜に使う、別の道具で代用する）を足さない。
- 書いてはいけないこと: 価格・販売場所・次回イベント日程・参加人数・満足度などの数字、写真にない作品や出来事、子どもの名前や年齢。`;

const EXAMPLE_CAPTION = `📖 ペパポン図鑑 No.2「かおのある ガチャ」

めだまを つけたり、はなを かいたり…かおが つくと、ガチャが いきものに見えてくる！👀
さんかくの はな、にっこり がお、ピンクの ほっぺ。
ワークショップでは、子どもたちが それぞれの キャラクターを うみだしてくれました🎨`;

async function readPerformanceNotes() {
  try {
    const { listPostsFromSupabase } = await import("@/lib/supabase-admin");
    const posts = (await listPostsFromSupabase("owner", { limit: 60, offset: 0 }))
      .filter((post) => post.caption && (post.views ?? 0) > 0);
    if (posts.length < 3) return "";
    const score = (post: (typeof posts)[number]) => (post.saves ?? 0) * 3 + (post.shares ?? 0) * 3 + (post.likes ?? 0) + (post.comments ?? 0) * 2 + (post.views ?? 0) / 100;
    const sorted = [...posts].sort((a, b) => score(b) - score(a));
    const line = (post: (typeof posts)[number]) => `- ${post.date} 再生${post.views ?? 0} いいね${post.likes ?? 0} 保存${post.saves ?? 0} 「${String(post.caption).split("\n")[0].slice(0, 40)}」`;
    return `反応がよかった投稿（この傾向を参考にする）:\n${sorted.slice(0, 4).map(line).join("\n")}\n反応がいまひとつだった投稿（同じ書き方は避ける）:\n${sorted.slice(-3).map(line).join("\n")}`;
  } catch {
    return "";
  }
}

const planSchema = {
  type: "object",
  additionalProperties: false,
  required: ["style", "theme", "lines", "photos", "quizId", "tomorrowTeaser", "caption", "commentPrompt", "hashtags"],
  properties: {
    style: { type: "string", enum: [...AUTOPOST_STYLES] },
    theme: { type: "string", description: "動画のタイトル。子どもが読めるひらがな多めで、12文字以内" },
    lines: { type: "array", items: { type: "string" }, description: "写真に重ねる短いテロップ。ひらがな多め、各4〜9文字（10文字を超えない）、3〜4個。写真ごとに具体的に（「かわいい」だけ等の抽象語は避ける）。例: めだまが ぎょろっ / ピンクの しまもよう" },
    photos: { type: "array", items: { type: "string" }, description: "使う写真ID。4〜6枚" },
    quizId: { type: ["string", "null"], description: "style=quizのときだけ、クイズ一覧のIDを1つ。それ以外はnull" },
    tomorrowTeaser: { type: "string", description: "空文字でよい（自動で入る）" },
    caption: { type: "string", description: "キャプション本文（ハッシュタグ・固定の紹介文なし）。1行目は連載名入りの見出し、空行のあと写真の中身に具体的にふれる本文3〜4文。漢字かな交じりの自然な日本語、全体180〜320文字、絵文字3〜6個、1文ごとに改行" },
    commentPrompt: { type: "string", description: "コメントしたくなる問いかけ1文。40文字以内（例: どの作品がすき？番号でおしえてね！）" },
    hashtags: { type: "array", items: { type: "string" }, description: "#なしのハッシュタグを3つ。「タグ候補」の中から、今日の動画の中身に最も合う順に" },
  },
} as const;

const REQUIRED_TAGS = ["ペパポン", "新西ゼミ"];

function clip(value: unknown, max: number) {
  return typeof value === "string" ? Array.from(value.trim()).slice(0, max).join("") : "";
}

/** テロップは語の途中で切らない（長いときは最後の区切りまで。描画側で文字を自動縮小する） */
export function clipTelop(text: string, max = 16) {
  const chars = Array.from(text.replace(/[\s　]+/g, " ").trim());
  if (chars.length <= max) return chars.join("");
  const head = chars.slice(0, max).join("");
  const cut = Math.max(head.lastIndexOf(" "), head.lastIndexOf("、"));
  return (cut >= 4 ? head.slice(0, cut) : head).trim();
}

export function sanitizePlan(raw: unknown, photos: AutopostPhoto[], quizIds: string[] = [], forcedStyle?: AutopostStyle, teaser?: string): AutopostPlan {
  if (!raw || typeof raw !== "object") throw new ApiRequestError("企画データが正しくありません。", 502);
  const value = raw as Record<string, unknown>;
  const ids = new Set(photos.map((photo) => photo.id));
  let style = forcedStyle ?? (AUTOPOST_STYLES.includes(value.style as AutopostStyle) ? value.style as AutopostStyle : "pop");
  const quizId = typeof value.quizId === "string" && quizIds.includes(value.quizId) ? value.quizId : null;
  if (style === "quiz" && !quizId) style = "pop";
  const chosen = (Array.isArray(value.photos) ? value.photos : []).filter((id): id is string => typeof id === "string" && ids.has(id));
  const uniquePhotos = [...new Set(chosen)].slice(0, 6);
  const minPhotos = style === "spotlight" ? 2 : style === "ranking" ? 3 : 4;
  for (const photo of photos) {
    if (uniquePhotos.length >= minPhotos) break;
    if (!uniquePhotos.includes(photo.id)) uniquePhotos.push(photo.id);
  }
  const lines = (Array.isArray(value.lines) ? value.lines : []).map((line) => clipTelop(String(line))).filter(Boolean).slice(0, 4);
  const hashtags = [...new Set([
    ...REQUIRED_TAGS,
    ...(Array.isArray(value.hashtags) ? value.hashtags : []).map((tag) => clip(tag, 20).replace(/^#/, "").replace(/\s/g, "")).filter(Boolean),
  ])].slice(0, 5);
  return {
    style,
    theme: clip(value.theme, 12) || "だんボールガチャ",
    lines: lines.length ? lines : ["つくって", "かざって", "まわそう！"],
    photos: uniquePhotos,
    quizId: style === "quiz" ? quizId : null,
    tomorrowTeaser: clip(teaser ?? value.tomorrowTeaser, 14) || "おたのしみに",
    caption: clip(value.caption, 600),
    commentPrompt: clip(value.commentPrompt, 50),
    hashtags,
  };
}

export async function planTodaysPost(input: { date: string; weekday: string; photos: AutopostPhoto[]; ideas: string[]; quizzes: AutopostQuiz[]; tomorrowTheme?: string; tagPool?: string[] }) {
  if (!process.env.OPENAI_API_KEY) throw new ApiRequestError("OPENAI_API_KEY が設定されていません。", 503);
  const history = await readAutopostHistory();
  const recent = history.slice(-14);
  const series = seriesForDate(input.date);
  const teaser = input.tomorrowTheme || seriesForDate(nextDate(input.date)).name;
  const performance = await readPerformanceNotes();
  const prompt = `あなたは「だんボールガチャ ペパポン」のInstagram（@tamaenergycircle）を運用する、子ども向け工作が得意な編集者です。
今日 ${input.date}（${input.weekday}）に投稿する10秒の縦型リールを企画してください。

## 今日の連載「${series.name}」（style=${series.style} 固定）
${series.guide}

## 事実シート（これ以外の事実は書かない）
${FACT_SHEET}

## 書き方
- 動画のテロップ（theme / lines）は子どもが読める、ひらがな多めの短い言葉。
- キャプションは親や先生が読む前提で、漢字かな交じりの自然な日本語にする（ひらがなだらけにしない）。
- 1行目は「連載名 + 今日の中身」がひと目でわかる見出し（例: 🔍 きょうの いちだい「あおい かいじゅう」）。
- 本文は選んだ写真に写っている具体的なもの（色・かざり・形・道具）にふれる。「かわいい」「たのしい」だけで終わらせない。
- 子どもと一緒に話したくなる視点（観察・比べる・まねしてみる）を1つ入れる。
- 直近の投稿と同じ書き出し・同じ話題・同じ写真の組み合わせは避ける。
- commentPrompt は答えやすい問いかけ（番号・色・一言で答えられる）。本文の最後には問いかけを書かない（commentPrompt と重複するため）。
- 図鑑やランキングの通し番号（No.○）は書かない。
- hashtags は「タグ候補」から今日の中身に最も合う3つを選ぶ（Instagramは1投稿5個まで。#ペパポン #新西ゼミ は自動で付く）。
- Instagramの検索はキャプション本文の言葉も拾うので、本文に「ダンボール工作」「ガチャガチャ」「親子」などの検索されやすい言葉を自然に1〜2個入れる。

## キャプションの手本（雰囲気の参考。そのまま真似しない）
${EXAMPLE_CAPTION}
${performance ? `\n## これまでの反応\n${performance}\n` : ""}
## タグ候補
${(input.tagPool ?? []).join(" / ") || "ダンボール工作 / 親子工作 / 手作りおもちゃ"}

## クイズ一覧（style=quiz のときだけ。内容は変えない）
${input.quizzes.length ? input.quizzes.map((quiz) => `- ${quiz.id}: ${quiz.q}`).join("\n") : "- なし"}

## 使える写真（ID: 内容タグ。顔は写っていない）
${input.photos.map((photo) => `- ${photo.id}: ${photo.tags.join("、")}`).join("\n")}

## 直近の投稿
${recent.length ? recent.map((item) => `- ${item.date} style=${item.style} theme=${item.theme} photos=${item.photos.join(",")} 書き出し「${String(item.caption ?? "").split("\n")[0].slice(0, 30)}」`).join("\n") : "- まだありません"}

## 補足
- ideas（ヒント）: ${input.ideas.join(" / ")}`;

  const { response, data } = await fetchJsonWithTimeout("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.AUTOPOST_OPENAI_MODEL ?? "gpt-4.1",
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
  return { plan: sanitizePlan(parsed, input.photos, input.quizzes.map((quiz) => quiz.id), series.style, teaser), recent, series: series.name };
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
