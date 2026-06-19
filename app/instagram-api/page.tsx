"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, PageHeader, Panel, Stat } from "@/components/ui";

type InstagramApiPost = {
  id: string;
  caption?: string;
  timestamp?: string;
  media_type?: string;
  permalink?: string;
};

type InstagramProfile = {
  followers_count: number;
  follows_count: number;
  media_count: number;
};

type CaptionAnalysis = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  postIdeas: string[];
  hashtagAdvice: string[];
};

export default function InstagramApiPage() {
  const [profile, setProfile] = useState<InstagramProfile | null>(null);
  const [posts, setPosts] = useState<InstagramApiPost[]>([]);
  const [analysis, setAnalysis] = useState<CaptionAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [message, setMessage] = useState("");

  const dailyRows = useMemo(() => {
    const grouped = posts.reduce<Record<string, { date: string; postCount: number; hashtagCount: number }>>((result, post) => {
      const date = (post.timestamp ?? "").slice(0, 10) || "日付不明";
      const hashtags = countHashtags(post.caption ?? "");
      result[date] ??= { date, postCount: 0, hashtagCount: 0 };
      result[date].postCount += 1;
      result[date].hashtagCount += hashtags;
      return result;
    }, {});
    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  }, [posts]);

  const totals = useMemo(() => {
    const hashtagCount = posts.reduce((sum, post) => sum + countHashtags(post.caption ?? ""), 0);
    return {
      postCount: posts.length,
      hashtagCount,
      averageHashtagCount: posts.length ? hashtagCount / posts.length : 0
    };
  }, [posts]);

  const fetchPosts = async () => {
    setLoading(true);
    setMessage("");
    setAnalysis(null);
    try {
      const response = await fetch("/api/instagram/posts");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Instagram Graph APIの取得に失敗しました。");
      setProfile(data.profile);
      setPosts(data.posts);
      setMessage(`${data.posts.length}件の投稿を取得しました。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Instagram Graph APIの取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const analyzePosts = async () => {
    setAnalyzing(true);
    setMessage("");
    try {
      const response = await fetch("/api/instagram/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posts })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "投稿本文の分析に失敗しました。");
      setAnalysis(data.analysis);
      setMessage(`OpenAIで投稿本文を分析しました。使用モデル: ${data.model}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "投稿本文の分析に失敗しました。");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div>
      <PageHeader title="Instagram Graph API連携" description="Instagramビジネスアカウントの投稿をサーバー側で取得し、投稿本文をAI分析します。" />
      <Panel className="mb-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold">API取得</h2>
            <p className="mt-1 text-sm leading-6 text-stone-600">アクセストークンは環境変数だけで使用し、画面には表示しません。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={fetchPosts} disabled={loading}>{loading ? "取得中..." : "Graph APIから取得"}</Button>
            <Button variant="secondary" onClick={analyzePosts} disabled={analyzing || !posts.length}>{analyzing ? "分析中..." : "投稿本文をAI分析"}</Button>
          </div>
        </div>
        {message ? <p className="mt-4 rounded-md bg-skyglass px-3 py-2 text-sm text-ink">{message}</p> : null}
      </Panel>

      <div className="mb-6 grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="取得投稿数" value={`${totals.postCount}件`} />
        <Stat label="ハッシュタグ数" value={totals.hashtagCount.toLocaleString()} />
        <Stat label="平均ハッシュタグ" value={totals.averageHashtagCount.toFixed(1)} />
        <Stat label="フォロワー" value={(profile?.followers_count ?? 0).toLocaleString()} />
        <Stat label="フォロー" value={(profile?.follows_count ?? 0).toLocaleString()} />
        <Stat label="総投稿数" value={(profile?.media_count ?? 0).toLocaleString()} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartPanel title="投稿日別の投稿数">
          <BarChart data={dailyRows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="postCount" name="投稿数" fill="#53624a" />
          </BarChart>
        </ChartPanel>
        <ChartPanel title="投稿日別のハッシュタグ数">
          <BarChart data={dailyRows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="hashtagCount" name="ハッシュタグ数" fill="#b55d3e" />
          </BarChart>
        </ChartPanel>
      </div>

      {analysis ? (
        <Panel className="mt-6">
          <h2 className="font-semibold">OpenAIによる投稿本文分析</h2>
          <p className="mt-2 text-sm leading-6 text-stone-700">{analysis.summary}</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <List title="強み" items={analysis.strengths} />
            <List title="課題" items={analysis.weaknesses} />
            <List title="改善案" items={analysis.improvements} />
            <List title="おすすめ投稿案" items={analysis.postIdeas} />
            <List title="ハッシュタグ改善案" items={analysis.hashtagAdvice} />
          </div>
        </Panel>
      ) : null}

      <Panel className="mt-6">
        <h2 className="font-semibold">取得投稿一覧</h2>
        <div className="mt-4 overflow-auto">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>投稿日</th>
                <th>投稿タイプ</th>
                <th>ハッシュタグ数</th>
                <th>本文</th>
                <th>リンク</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id}>
                  <td className="font-mono text-xs">{post.id}</td>
                  <td>{formatDate(post.timestamp)}</td>
                  <td>{post.media_type ?? "不明"}</td>
                  <td>{countHashtags(post.caption ?? "")}</td>
                  <td className="max-w-xl whitespace-pre-wrap">{post.caption || "本文なし"}</td>
                  <td>{post.permalink ? <a className="font-semibold text-clay hover:underline" href={post.permalink} target="_blank" rel="noreferrer">開く</a> : "なし"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!posts.length ? <p className="py-8 text-center text-sm text-stone-500">まだ投稿を取得していません。</p> : null}
        </div>
      </Panel>
    </div>
  );
}

function countHashtags(caption: string) {
  return caption.match(/#[\p{L}\p{N}_]+/gu)?.length ?? 0;
}

function formatDate(value?: string) {
  if (!value) return "未記録";
  return new Date(value).toLocaleString("ja-JP");
}

function ChartPanel({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <Panel>
      <h2 className="mb-4 font-semibold">{title}</h2>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-md border border-stone-200 bg-white/80 p-4">
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-3 grid gap-2">
        {items.map((item) => (
          <li key={item} className="rounded-md bg-fog px-3 py-2 text-sm leading-6 text-stone-700">{item}</li>
        ))}
      </ul>
    </section>
  );
}
