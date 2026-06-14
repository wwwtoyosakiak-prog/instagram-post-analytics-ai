"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, PageHeader, Panel, Stat } from "@/components/ui";
import { deletePost, loadAccounts, loadPosts } from "@/lib/storage";
import { AiAnalysis, InstagramAccount, InstagramPost } from "@/lib/types";
import { formatPercent, getMetrics, postTypeLabels } from "@/lib/metrics";
import { createSampleAnalysis } from "@/lib/sample-analysis";

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [post, setPost] = useState<InstagramPost | null>(null);
  const [account, setAccount] = useState<InstagramAccount | null>(null);
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const foundPost = loadPosts().find((item) => item.id === params.id) ?? null;
    setPost(foundPost);
    setAccount(loadAccounts().find((item) => item.id === foundPost?.accountId) ?? null);
  }, [params.id]);

  if (!post) {
    return <PageHeader title="投稿が見つかりません" description="一覧から投稿を選び直してください。" />;
  }

  const metrics = getMetrics(post);

  const analyze = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post, account })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "分析に失敗しました。");
      setAnalysis(data.analysis);
    } catch (event) {
      setError(event instanceof Error ? event.message : "分析に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const removePost = () => {
    if (!window.confirm("この投稿データを削除しますか？")) return;
    deletePost(post.id);
    router.push("/posts");
  };

  return (
    <div>
      <PageHeader title="投稿詳細・AI分析" description="投稿内容、画像、数値をもとに改善案を確認します。" />
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="エンゲージメント数" value={metrics.engagement.toLocaleString()} />
        <Stat label="エンゲージメント率" value={formatPercent(metrics.engagementRate)} />
        <Stat label="保存率" value={formatPercent(metrics.saveRate)} />
        <Stat label="コメント率" value={formatPercent(metrics.commentRate)} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[420px_1fr]">
        <Panel>
          {post.screenshot ? <img src={post.screenshot} alt="投稿画像" className="mb-4 max-h-[520px] w-full rounded-md object-contain" /> : <div className="mb-4 rounded-md bg-stone-100 p-8 text-center text-sm text-stone-500">画像スクショ未登録</div>}
          <dl className="space-y-3 text-sm">
            <div><dt className="font-semibold">投稿日</dt><dd>{post.date}</dd></div>
            <div><dt className="font-semibold">データ登録日</dt><dd>{post.recordedDate ?? post.date}</dd></div>
            <div><dt className="font-semibold">アカウント</dt><dd>{account ? `${account.name}（@${account.username}）` : "未選択"}</dd></div>
            <div><dt className="font-semibold">投稿タイプ</dt><dd>{postTypeLabels[post.type]}</dd></div>
            <div><dt className="font-semibold">投稿画像・動画の枚数</dt><dd>{post.mediaCount ?? 1}</dd></div>
            <div><dt className="font-semibold">投稿URL</dt><dd className="break-all">{post.url || "未登録"}</dd></div>
            <div><dt className="font-semibold">投稿コメント</dt><dd className="leading-6">{post.caption}</dd></div>
            <div><dt className="font-semibold">ハッシュタグ</dt><dd className="leading-6">{post.hashtags || "なし"}</dd></div>
            <div><dt className="font-semibold">メモ</dt><dd className="leading-6">{post.memo || "なし"}</dd></div>
            <div><dt className="font-semibold">登録日時</dt><dd>{formatDateTime(post.createdAt)}</dd></div>
            <div><dt className="font-semibold">編集日時</dt><dd>{formatDateTime(post.updatedAt ?? post.createdAt)}</dd></div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={`/posts/${post.id}/edit`} className="inline-flex h-10 items-center justify-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold text-ink hover:border-moss">
              編集
            </Link>
            <Button variant="secondary" onClick={removePost}>削除</Button>
          </div>
        </Panel>
        <Panel>
          <div className="mb-4 flex flex-wrap gap-2">
            <Button onClick={analyze} disabled={loading}>{loading ? "分析中..." : "OpenAIで分析"}</Button>
            <Button variant="secondary" onClick={() => setAnalysis(createSampleAnalysis(post))}>サンプル分析</Button>
          </div>
          {error ? <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          {analysis ? <AnalysisView analysis={analysis} /> : <p className="text-sm text-stone-600">APIキーがない場合はサンプル分析を使えます。</p>}
        </Panel>
      </div>
    </div>
  );
}

function formatDateTime(value?: string) {
  if (!value) return "未記録";
  return new Date(value).toLocaleString("ja-JP");
}

function AnalysisView({ analysis }: { analysis: AiAnalysis }) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-skyglass p-4">
        <p className="text-sm font-medium text-stone-600">投稿スコア</p>
        <p className="mt-1 text-4xl font-bold text-ink">{analysis.score}<span className="text-lg"> / 100</span></p>
      </div>
      {[
        ["投稿の第一印象", analysis.firstImpression],
        ["画像から伝わる内容", analysis.imageMessage],
        ["キャプションのわかりやすさ", analysis.captionClarity],
        ["数値から見た強み", analysis.strengths],
        ["数値から見た弱み", analysis.weaknesses],
        ["伸びた / 伸びなかった可能性", analysis.reason]
      ].map(([title, body]) => (
        <section key={title}>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-stone-700">{body}</p>
        </section>
      ))}
      <List title="次回改善案" items={analysis.improvements} />
      <List title="おすすめ投稿案" items={analysis.nextIdeas} />
      <List title="おすすめハッシュタグ" items={analysis.hashtags} />
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h2 className="font-semibold">{title}</h2>
      <ul className="mt-2 grid gap-2">
        {items.map((item) => <li key={item} className="rounded-md bg-stone-100 px-3 py-2 text-sm">{item}</li>)}
      </ul>
    </section>
  );
}
