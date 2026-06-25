"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button, PageHeader, Panel } from "@/components/ui";
import { loadAnalysesData, loadCategoriesData, loadPostsData, saveAnalysisData } from "@/lib/cloud-storage";
import { InstagramPost, PostCategoryDefinition, PostType } from "@/lib/types";
import { formatPercent, getMetrics, getPostCategoryLabel, postTypeLabels } from "@/lib/metrics";

// --- Graph API types ---
interface Media {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  latest_insights?: {
    views?: number | null;
    reach?: number | null;
    likes?: number | null;
    saved?: number | null;
    shares?: number | null;
    ig_reels_avg_watch_time?: number | null;
  } | null;
}

type GraphSortKey = "timestamp" | "views" | "reach" | "saved" | "likes";
type ManualSortKey = "date" | "recordedDate" | "likes" | "saves" | "views" | "engagementRate";
type ViewMode = "table" | "cards";
type TabKey = "graph" | "manual";

const fmtNum = (v: number | null | undefined) =>
  v == null ? "–" : v.toLocaleString("ja-JP");

const pctFmt = (num: number | null | undefined, den: number | null | undefined) => {
  if (num == null || den == null || den === 0) return "–";
  return `${((num / den) * 100).toFixed(1)}%`;
};

function MediaTypeBadge({ type }: { type: string }) {
  const color =
    type === "VIDEO" ? "bg-pink-100 text-pink-600"
    : type === "CAROUSEL_ALBUM" ? "bg-blue-100 text-blue-600"
    : "bg-stone-100 text-stone-600";
  const label =
    type === "VIDEO" ? "リール/動画"
    : type === "CAROUSEL_ALBUM" ? "カルーセル"
    : "画像";
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{label}</span>;
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm font-semibold border-b-2 transition -mb-px ${
        active ? "border-ink text-ink" : "border-transparent text-stone-500 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export default function PostsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("graph");

  // --- Graph API tab state ---
  const [media, setMedia] = useState<Media[]>([]);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [graphSort, setGraphSort] = useState<GraphSortKey>("timestamp");
  const [typeFilter, setTypeFilter] = useState("");

  // --- Manual tab state ---
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [categories, setCategories] = useState<PostCategoryDefinition[]>([]);
  const [manualSort, setManualSort] = useState<ManualSortKey>("date");
  const [postType, setPostType] = useState<PostType | "all">("all");
  const [category, setCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [latestScoreByPostId, setLatestScoreByPostId] = useState<Record<string, number>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState("");

  useEffect(() => {
    Promise.all([loadPostsData(), loadCategoriesData()]).then(([loadedPosts, loadedCategories]) => {
      setPosts(loadedPosts);
      setCategories(loadedCategories);
      Promise.all(
        loadedPosts.map(async (post) => [post.id, (await loadAnalysesData(post.id))[0]?.score] as const)
      ).then((scores) => {
        setLatestScoreByPostId(Object.fromEntries(scores.filter(([, score]) => typeof score === "number")));
      });
    });
  }, []);

  useEffect(() => {
    setMediaLoading(true);
    let url = "/api/instagram/media?limit=100";
    if (typeFilter) url += `&media_type=${typeFilter}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => setMedia((d as { data: Media[] }).data ?? []))
      .finally(() => setMediaLoading(false));
  }, [typeFilter]);

  const sortedMedia = useMemo(
    () =>
      [...media].sort((a, b) => {
        if (graphSort === "timestamp") return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        const av = a.latest_insights?.[graphSort as keyof NonNullable<Media["latest_insights"]>] ?? 0;
        const bv = b.latest_insights?.[graphSort as keyof NonNullable<Media["latest_insights"]>] ?? 0;
        return (bv as number) - (av as number);
      }),
    [media, graphSort]
  );

  const filtered = useMemo(
    () =>
      posts
        .filter((post) => postType === "all" || post.type === postType)
        .filter((post) => category === "all" || (post.category ?? "other") === category)
        .sort((a, b) => {
          if (manualSort === "date") return new Date(b.date).getTime() - new Date(a.date).getTime();
          if (manualSort === "recordedDate")
            return new Date(b.recordedDate ?? b.date).getTime() - new Date(a.recordedDate ?? a.date).getTime();
          if (manualSort === "engagementRate") return getMetrics(b).engagementRate - getMetrics(a).engagementRate;
          return (b[manualSort] as number) - (a[manualSort] as number);
        }),
    [posts, manualSort, postType, category]
  );

  const analyzeFilteredPosts = async (onlyMissing: boolean) => {
    const targets = filtered.filter((post) => !onlyMissing || typeof latestScoreByPostId[post.id] !== "number");
    if (!targets.length) {
      setAiMessage(onlyMissing ? "未分析の投稿はありません。" : "評価できる投稿がありません。");
      return;
    }
    const limitedTargets = targets.slice(0, 10);
    const confirmText = onlyMissing
      ? `表示中の未分析投稿 ${limitedTargets.length}件をOpenAI APIで評価します。API料金が発生します。実行しますか？`
      : `表示中の投稿 ${limitedTargets.length}件をOpenAI APIで再評価します。API料金が発生します。実行しますか？`;
    if (!window.confirm(confirmText)) return;

    setAiLoading(true);
    setAiMessage(`AI評価を開始しました。0/${limitedTargets.length}件`);
    let success = 0;
    try {
      for (const post of limitedTargets) {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ post, account: null }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "AI評価に失敗しました。");
        const saved = await saveAnalysisData(post.id, data.analysis);
        const score = saved?.score ?? data.analysis?.score;
        if (typeof score === "number") {
          setLatestScoreByPostId((current) => ({ ...current, [post.id]: score }));
        }
        success += 1;
        setAiMessage(`AI評価中です。${success}/${limitedTargets.length}件完了`);
      }
      setAiMessage(`AI評価が完了しました。${success}件の投稿を評価・保存しました。`);
    } catch (error) {
      setAiMessage(
        error instanceof Error
          ? `AI評価が途中で止まりました。${success}件完了。理由: ${error.message}`
          : `AI評価が途中で止まりました。${success}件完了。`
      );
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="投稿一覧" description="Graph APIで取得した投稿と手入力データを確認できます。" />

      {/* タブ */}
      <div className="mb-6 flex gap-1 border-b border-stone-200">
        <TabButton active={activeTab === "graph"} onClick={() => setActiveTab("graph")}>
          Graph APIデータ
        </TabButton>
        <TabButton active={activeTab === "manual"} onClick={() => setActiveTab("manual")}>
          手入力データ
        </TabButton>
      </div>

      {/* Graph APIタブ */}
      {activeTab === "graph" && (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-sm border border-stone-200 rounded-md px-3 py-1.5 bg-white"
            >
              <option value="">すべてのタイプ</option>
              <option value="VIDEO">リール/動画</option>
              <option value="IMAGE">画像</option>
              <option value="CAROUSEL_ALBUM">カルーセル</option>
            </select>
            <select
              value={graphSort}
              onChange={(e) => setGraphSort(e.target.value as GraphSortKey)}
              className="text-sm border border-stone-200 rounded-md px-3 py-1.5 bg-white"
            >
              <option value="timestamp">投稿日順</option>
              <option value="views">閲覧数順</option>
              <option value="reach">リーチ順</option>
              <option value="saved">保存数順</option>
              <option value="likes">いいね順</option>
            </select>
            {!mediaLoading && (
              <span className="text-sm text-stone-500">{sortedMedia.length} 件</span>
            )}
          </div>

          {mediaLoading ? (
            <p className="py-12 text-center text-sm text-stone-500">読み込み中...</p>
          ) : (
            <div className="space-y-3">
              {sortedMedia.map((m) => {
                const ins = m.latest_insights;
                const isVideo = m.media_type === "VIDEO";
                return (
                  <div
                    key={m.id}
                    className="rounded-xl border border-stone-200 bg-white p-4 shadow-panel transition hover:border-moss"
                  >
                    <div className="flex gap-4">
                      <div className="shrink-0">
                        {m.thumbnail_url ?? m.media_url ? (
                          <img
                            src={m.thumbnail_url ?? m.media_url}
                            alt=""
                            className="w-20 h-20 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="w-20 h-20 bg-stone-100 rounded-lg flex items-center justify-center text-stone-400 text-xs">
                            No img
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <MediaTypeBadge type={m.media_type} />
                          <span className="text-xs text-stone-400">
                            {new Date(m.timestamp).toLocaleDateString("ja-JP", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-stone-700 line-clamp-2 mb-2">
                          {m.caption ?? "（キャプションなし）"}
                        </p>
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                          {isVideo && (
                            <div className="text-center">
                              <p className="text-stone-400">閲覧数</p>
                              <p className="font-bold text-pink-600">{fmtNum(ins?.views)}</p>
                            </div>
                          )}
                          <div className="text-center">
                            <p className="text-stone-400">リーチ</p>
                            <p className="font-bold">{fmtNum(ins?.reach)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-stone-400">いいね</p>
                            <p className="font-bold">{fmtNum(ins?.likes)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-stone-400">保存</p>
                            <p className="font-bold text-green-600">{fmtNum(ins?.saved)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-stone-400">保存率</p>
                            <p className="font-bold">
                              {pctFmt(ins?.saved, ins?.views ?? ins?.reach)}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-stone-400">シェア</p>
                            <p className="font-bold">{fmtNum(ins?.shares)}</p>
                          </div>
                          {isVideo && (
                            <div className="text-center">
                              <p className="text-stone-400">平均再生時間</p>
                              <p className="font-bold">
                                {ins?.ig_reels_avg_watch_time != null
                                  ? `${Math.round(ins.ig_reels_avg_watch_time / 1000)}秒`
                                  : "–"}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <a
                          href={m.permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs px-3 py-1.5 border border-stone-300 rounded-lg text-stone-600 hover:bg-stone-50"
                        >
                          開く
                        </a>
                        {isVideo && (
                          <Link
                            href={`/reel-insights?id=${m.id}`}
                            className="text-xs px-3 py-1.5 bg-pink-500 text-white rounded-lg text-center hover:bg-pink-600"
                          >
                            詳細分析
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {sortedMedia.length === 0 && (
                <div className="py-12 text-center text-sm text-stone-500">
                  <p>投稿データがありません。</p>
                  <p className="mt-1">ダッシュボードの「Instagramデータ同期」ボタンでデータを取得してください。</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 手入力データタブ */}
      {activeTab === "manual" && (
        <Panel>
          <div className="mb-5 rounded-md border border-stone-200 bg-fog/80 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-semibold">実投稿のAI評価</h2>
                <p className="mt-1 text-sm leading-6 text-stone-600">
                  登録済みの投稿データとスクショをOpenAI APIで評価し、投稿スコア・改善案・投稿提案を保存します。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => analyzeFilteredPosts(true)} disabled={aiLoading}>
                  {aiLoading ? "評価中..." : "未分析をAI評価"}
                </Button>
                <Button variant="secondary" onClick={() => analyzeFilteredPosts(false)} disabled={aiLoading}>
                  表示中を再評価
                </Button>
              </div>
            </div>
            {aiMessage ? (
              <p className="mt-3 rounded-md bg-skyglass px-3 py-2 text-sm text-ink">{aiMessage}</p>
            ) : null}
            <p className="mt-2 text-xs text-stone-500">
              料金を抑えるため、一度に評価する投稿は最大10件までです。対象は下の絞り込み条件に連動します。
            </p>
          </div>
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <div>
              <label>並び替え</label>
              <select value={manualSort} onChange={(e) => setManualSort(e.target.value as ManualSortKey)}>
                <option value="date">投稿日順</option>
                <option value="recordedDate">データ登録日順</option>
                <option value="likes">いいね数順</option>
                <option value="saves">保存数順</option>
                <option value="views">表示数順</option>
                <option value="engagementRate">エンゲージメント率順</option>
              </select>
            </div>
            <div>
              <label>投稿タイプ</label>
              <select value={postType} onChange={(e) => setPostType(e.target.value as PostType | "all")}>
                <option value="all">すべて</option>
                <option value="image">画像</option>
                <option value="video">動画</option>
                <option value="reel">リール</option>
                <option value="carousel">カルーセル</option>
              </select>
            </div>
            <div>
              <label>投稿カテゴリ</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="all">すべて</option>
                {categories.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>表示形式</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`h-10 rounded-md border px-3 text-sm font-semibold ${
                    viewMode === "table" ? "border-ink bg-ink text-white" : "border-stone-200 bg-white text-ink"
                  }`}
                >
                  表
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={`h-10 rounded-md border px-3 text-sm font-semibold ${
                    viewMode === "cards" ? "border-ink bg-ink text-white" : "border-stone-200 bg-white text-ink"
                  }`}
                >
                  カード
                </button>
              </div>
            </div>
          </div>
          {viewMode === "table" ? (
            <div className="overflow-auto">
              <table>
                <thead>
                  <tr>
                    <th>投稿</th>
                    <th>投稿日</th>
                    <th>データ登録日</th>
                    <th>タイプ</th>
                    <th>カテゴリ</th>
                    <th>枚数</th>
                    <th>投稿コメント</th>
                    <th>ハッシュタグ</th>
                    <th>表示</th>
                    <th>いいね</th>
                    <th>保存</th>
                    <th>エンゲージメント率</th>
                    <th>登録日時</th>
                    <th>編集日時</th>
                    <th>詳細</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((post) => {
                    const metrics = getMetrics(post);
                    return (
                      <tr key={post.id}>
                        <td>
                          <PostThumbnail post={post} className="h-14 w-14" />
                        </td>
                        <td>{toJSTDate(post.date)}</td>
                        <td>{toJSTDate(post.recordedDate ?? post.date)}</td>
                        <td>{postTypeLabels[post.type]}</td>
                        <td>{getPostCategoryLabel(post.category, categories)}</td>
                        <td>{post.mediaCount ?? 1}</td>
                        <td className="max-w-sm">{post.caption}</td>
                        <td className="max-w-xs">{post.hashtags || "なし"}</td>
                        <td>{post.views.toLocaleString()}</td>
                        <td>{post.likes.toLocaleString()}</td>
                        <td>{post.saves.toLocaleString()}</td>
                        <td>{formatPercent(metrics.engagementRate)}</td>
                        <td>{formatDateTime(post.createdAt)}</td>
                        <td>{formatDateTime(post.updatedAt ?? post.createdAt)}</td>
                        <td>
                          <Link className="font-semibold text-clay hover:underline" href={`/posts/detail?id=${post.id}`}>
                            開く
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!filtered.length ? (
                <p className="py-8 text-center text-sm text-stone-500">投稿がありません。</p>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  aiScore={latestScoreByPostId[post.id]}
                  categoryLabel={getPostCategoryLabel(post.category, categories)}
                />
              ))}
              {!filtered.length ? (
                <p className="py-8 text-center text-sm text-stone-500 md:col-span-2 xl:col-span-3">
                  投稿がありません。
                </p>
              ) : null}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}

function PostCard({
  post,
  aiScore,
  categoryLabel,
}: {
  post: InstagramPost;
  aiScore?: number;
  categoryLabel: string;
}) {
  const metrics = getMetrics(post);
  return (
    <Link
      href={`/posts/detail?id=${post.id}`}
      className="group overflow-hidden rounded-lg border border-stone-200 bg-white/82 shadow-panel transition hover:border-moss hover:bg-white"
    >
      <div className="aspect-[4/3] bg-fog">
        {getPostPreview(post) ? (
          <img
            src={getPostPreview(post)}
            alt="投稿サムネイル"
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-stone-500">
            画像スクショ未登録
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="mb-3 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-ink px-2 py-1 text-white">{categoryLabel}</span>
          <span className="rounded-full bg-fog px-2 py-1 text-stone-700">{postTypeLabels[post.type]}</span>
          <span className="rounded-full bg-skyglass px-2 py-1 text-ink">
            AI {typeof aiScore === "number" ? `${aiScore}点` : "未分析"}
          </span>
        </div>
        <p className="text-xs font-semibold text-stone-500">{toJSTDate(post.date)}</p>
        <h2 className="mt-2 line-clamp-3 min-h-[4.5rem] text-sm font-semibold leading-6 text-ink">
          {post.caption || "投稿コメントなし"}
        </h2>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          <CardMetric label="表示" value={post.views.toLocaleString()} />
          <CardMetric label="保存率" value={formatPercent(metrics.saveRate)} />
          <CardMetric label="ER" value={formatPercent(metrics.engagementRate)} />
        </div>
        <p className="mt-3 line-clamp-2 text-xs leading-5 text-stone-500">{post.hashtags || "ハッシュタグなし"}</p>
      </div>
    </Link>
  );
}

function PostThumbnail({ post, className }: { post: InstagramPost; className: string }) {
  const preview = getPostPreview(post);
  return preview ? (
    <img src={preview} alt="投稿サムネイル" className={`${className} rounded-md object-cover`} />
  ) : (
    <span className={`${className} flex items-center justify-center rounded-md bg-fog text-[10px] text-stone-500`}>
      画像なし
    </span>
  );
}

function getPostPreview(post: InstagramPost) {
  return post.screenshot || post.thumbnailUrl || post.mediaUrl || "";
}

function CardMetric({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-md bg-fog px-2 py-2">
      <span className="block text-[11px] font-semibold text-stone-500">{label}</span>
      <span className="mt-1 block font-bold text-ink">{value}</span>
    </span>
  );
}

function formatDateTime(value?: string) {
  if (!value) return "未記録";
  return new Date(value).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

function toJSTDate(value?: string) {
  if (!value) return "未記録";
  return new Date(value).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
}
