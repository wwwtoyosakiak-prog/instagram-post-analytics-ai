"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button, ButtonLink, PageHeader, Panel } from "@/components/ui";
import { loadAccountsData, loadAnalysesData, loadPostsData, saveAnalysisData } from "@/lib/cloud-storage";
import { InstagramAccount, InstagramPost, PostCategory, PostType } from "@/lib/types";
import { formatPercent, getMetrics, postCategoryLabels, postCategoryOptions, postTypeLabels } from "@/lib/metrics";

type SortKey = "date" | "recordedDate" | "likes" | "saves" | "views" | "engagementRate";
type ViewMode = "table" | "cards";

export default function PostsPage() {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [sort, setSort] = useState<SortKey>("date");
  const [type, setType] = useState<PostType | "all">("all");
  const [category, setCategory] = useState<PostCategory | "all">("all");
  const [accountId, setAccountId] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [latestScoreByPostId, setLatestScoreByPostId] = useState<Record<string, number>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState("");

  useEffect(() => {
    Promise.all([loadPostsData(), loadAccountsData()]).then(([loadedPosts, loadedAccounts]) => {
      setPosts(loadedPosts);
      setAccounts(loadedAccounts);
      Promise.all(loadedPosts.map(async (post) => [post.id, (await loadAnalysesData(post.id))[0]?.score] as const)).then((scores) => {
        setLatestScoreByPostId(Object.fromEntries(scores.filter(([, score]) => typeof score === "number")));
      });
    });
  }, []);

  const filtered = useMemo(() => {
    return posts
      .filter((post) => accountId === "all" || post.accountId === accountId)
      .filter((post) => type === "all" || post.type === type)
      .filter((post) => category === "all" || (post.category ?? "other") === category)
      .sort((a, b) => {
        if (sort === "date") return new Date(b.date).getTime() - new Date(a.date).getTime();
        if (sort === "recordedDate") return new Date(b.recordedDate ?? b.date).getTime() - new Date(a.recordedDate ?? a.date).getTime();
        if (sort === "engagementRate") return getMetrics(b).engagementRate - getMetrics(a).engagementRate;
        return b[sort] - a[sort];
      });
  }, [posts, sort, type, category, accountId]);

  const accountNameById = useMemo(() => Object.fromEntries(accounts.map((account) => [account.id, account.name])), [accounts]);

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
        const account = accounts.find((item) => item.id === post.accountId) ?? null;
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ post, account })
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
      setAiMessage(error instanceof Error ? `AI評価が途中で止まりました。${success}件完了。理由: ${error.message}` : `AI評価が途中で止まりました。${success}件完了。`);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="投稿一覧" description="登録済み投稿を表またはカードで確認し、成果順に並び替えできます。" action={<ButtonLink href="/posts/new">投稿を追加</ButtonLink>} />
      <Panel>
        <div className="mb-5 rounded-md border border-stone-200 bg-fog/80 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-semibold">実投稿のAI評価</h2>
              <p className="mt-1 text-sm leading-6 text-stone-600">登録済みの投稿データとスクショをOpenAI APIで評価し、投稿スコア・改善案・投稿提案を保存します。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => analyzeFilteredPosts(true)} disabled={aiLoading}>{aiLoading ? "評価中..." : "未分析をAI評価"}</Button>
              <Button variant="secondary" onClick={() => analyzeFilteredPosts(false)} disabled={aiLoading}>表示中を再評価</Button>
            </div>
          </div>
          {aiMessage ? <p className="mt-3 rounded-md bg-skyglass px-3 py-2 text-sm text-ink">{aiMessage}</p> : null}
          <p className="mt-2 text-xs text-stone-500">料金を抑えるため、一度に評価する投稿は最大10件までです。対象は下の絞り込み条件に連動します。</p>
        </div>
        <div className="mb-4 grid gap-3 md:grid-cols-5">
          <div>
            <label>アカウント</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="all">すべて</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label>並び替え</label>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
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
            <select value={type} onChange={(e) => setType(e.target.value as PostType | "all")}>
              <option value="all">すべて</option>
              <option value="image">画像</option>
              <option value="video">動画</option>
              <option value="reel">リール</option>
              <option value="carousel">カルーセル</option>
            </select>
          </div>
          <div>
            <label>投稿カテゴリ</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as PostCategory | "all")}>
              <option value="all">すべて</option>
              {postCategoryOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label>表示形式</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setViewMode("table")} className={`h-10 rounded-md border px-3 text-sm font-semibold ${viewMode === "table" ? "border-ink bg-ink text-white" : "border-stone-200 bg-white text-ink"}`}>表</button>
              <button type="button" onClick={() => setViewMode("cards")} className={`h-10 rounded-md border px-3 text-sm font-semibold ${viewMode === "cards" ? "border-ink bg-ink text-white" : "border-stone-200 bg-white text-ink"}`}>カード</button>
            </div>
          </div>
        </div>
        {viewMode === "table" ? (
          <div className="overflow-auto">
            <table>
              <thead>
                <tr>
                  <th>投稿日</th>
                  <th>データ登録日</th>
                  <th>アカウント</th>
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
                      <td>{post.date}</td>
                      <td>{post.recordedDate ?? post.date}</td>
                      <td>{post.accountId ? accountNameById[post.accountId] ?? "未登録" : "未選択"}</td>
                      <td>{postTypeLabels[post.type]}</td>
                      <td>{postCategoryLabels[post.category ?? "other"]}</td>
                      <td>{post.mediaCount ?? 1}</td>
                      <td className="max-w-sm">{post.caption}</td>
                      <td className="max-w-xs">{post.hashtags || "なし"}</td>
                      <td>{post.views.toLocaleString()}</td>
                      <td>{post.likes.toLocaleString()}</td>
                      <td>{post.saves.toLocaleString()}</td>
                      <td>{formatPercent(metrics.engagementRate)}</td>
                      <td>{formatDateTime(post.createdAt)}</td>
                      <td>{formatDateTime(post.updatedAt ?? post.createdAt)}</td>
                      <td><Link className="font-semibold text-clay hover:underline" href={`/posts/detail?id=${post.id}`}>開く</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!filtered.length ? <p className="py-8 text-center text-sm text-stone-500">投稿がありません。</p> : null}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                accountName={post.accountId ? accountNameById[post.accountId] : undefined}
                aiScore={latestScoreByPostId[post.id]}
              />
            ))}
            {!filtered.length ? <p className="py-8 text-center text-sm text-stone-500 md:col-span-2 xl:col-span-3">投稿がありません。</p> : null}
          </div>
        )}
      </Panel>
    </div>
  );
}

function PostCard({ post, accountName, aiScore }: { post: InstagramPost; accountName?: string; aiScore?: number }) {
  const metrics = getMetrics(post);
  return (
    <Link href={`/posts/detail?id=${post.id}`} className="group overflow-hidden rounded-lg border border-stone-200 bg-white/82 shadow-panel transition hover:border-moss hover:bg-white">
      <div className="aspect-[4/3] bg-fog">
        {post.screenshot ? (
          <img src={post.screenshot} alt="投稿画像" className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-stone-500">画像スクショ未登録</div>
        )}
      </div>
      <div className="p-4">
        <div className="mb-3 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-ink px-2 py-1 text-white">{postCategoryLabels[post.category ?? "other"]}</span>
          <span className="rounded-full bg-fog px-2 py-1 text-stone-700">{postTypeLabels[post.type]}</span>
          <span className="rounded-full bg-skyglass px-2 py-1 text-ink">AI {typeof aiScore === "number" ? `${aiScore}点` : "未分析"}</span>
        </div>
        <p className="text-xs font-semibold text-stone-500">{post.date} / {accountName ?? "未選択"}</p>
        <h2 className="mt-2 line-clamp-3 min-h-[4.5rem] text-sm font-semibold leading-6 text-ink">{post.caption || "投稿コメントなし"}</h2>
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
  return new Date(value).toLocaleString("ja-JP");
}
