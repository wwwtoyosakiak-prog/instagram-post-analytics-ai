"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button, PageHeader, Panel } from "@/components/ui";
import { compareBenchmarks } from "@/lib/competitor-comparison";
import type { InstagramPost } from "@/lib/types";

type Competitor = {
  id: string;
  name: string;
  username: string;
};

type CompetitorPost = {
  id: string;
  competitorId: string;
  postedAt: string;
  postType: "image" | "video" | "reel" | "carousel";
  caption: string;
  hashtags: string;
  likes: number;
  comments: number;
  views: number;
  saves: number | null;
  shares: number | null;
};

type Summary = {
  posts: number;
  totalViews: number;
  averageViews: number;
  averageInteractions: number;
  engagementRate: number;
  topPostType: string | null;
  topHashtags: string[];
};

const emptyForm = {
  postedAt: new Date().toISOString().slice(0, 10),
  postType: "reel" as const,
  caption: "",
  hashtags: "",
  likes: "0",
  comments: "0",
  views: "0",
  saves: "",
  shares: "",
  sourceUrl: "",
};

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [competitorPosts, setCompetitorPosts] = useState<CompetitorPost[]>([]);
  const [ownPosts, setOwnPosts] = useState<InstagramPost[]>([]);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [savingPost, setSavingPost] = useState(false);

  async function loadCompetitors() {
    const response = await fetch("/api/competitors", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "取得に失敗しました。");
    setCompetitors(data.competitors ?? []);
  }

  async function loadOwnPosts() {
    const response = await fetch("/api/data/posts", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setOwnPosts(data.posts ?? []);
  }

  async function loadCompetitor(id: string) {
    setSelectedId(id);
    setMessage("");

    if (!id) {
      setSummary(null);
      setCompetitorPosts([]);
      return;
    }

    const response = await fetch(
      `/api/competitor-posts?competitorId=${encodeURIComponent(id)}`,
      { cache: "no-store" },
    );
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "集計に失敗しました。");
      return;
    }

    setSummary(data.summary);
    setCompetitorPosts(data.posts ?? []);
  }

  useEffect(() => {
    void Promise.all([loadCompetitors(), loadOwnPosts()]).catch((caught) =>
      setError(caught instanceof Error ? caught.message : "取得に失敗しました。"),
    );
  }, []);

  async function addCompetitor(event: FormEvent) {
    event.preventDefault();
    setError("");

    const response = await fetch("/api/competitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, username }),
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "登録に失敗しました。");
      return;
    }

    setName("");
    setUsername("");
    setMessage("競合アカウントを登録しました。");
    await loadCompetitors();
  }

  async function addCompetitorPost(event: FormEvent) {
    event.preventDefault();

    if (!selectedId) {
      setError("先に競合アカウントを選択してください。");
      return;
    }

    setSavingPost(true);
    setError("");
    setMessage("");

    const response = await fetch("/api/competitor-posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        competitorId: selectedId,
        ...form,
        likes: Number(form.likes),
        comments: Number(form.comments),
        views: Number(form.views),
        saves: form.saves === "" ? null : Number(form.saves),
        shares: form.shares === "" ? null : Number(form.shares),
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "競合投稿を登録できませんでした。");
      setSavingPost(false);
      return;
    }

    setForm(emptyForm);
    setMessage("競合投稿を登録しました。");
    await loadCompetitor(selectedId);
    setSavingPost(false);
  }

  const ownSummary = useMemo(() => {
    const interactions = ownPosts.map(
      (post) => post.likes + post.comments + post.saves + post.shares,
    );
    const rates = ownPosts.map((post, index) =>
      post.views > 0 ? (interactions[index] / post.views) * 100 : 0,
    );
    const typeCounts = new Map<string, number>();

    ownPosts.forEach((post) =>
      typeCounts.set(post.type, (typeCounts.get(post.type) ?? 0) + 1),
    );

    return {
      posts: ownPosts.length,
      averageViews: ownPosts.length
        ? ownPosts.reduce((sum, post) => sum + post.views, 0) / ownPosts.length
        : 0,
      engagementRate: rates.length
        ? rates.reduce((sum, value) => sum + value, 0) / rates.length
        : 0,
      topPostType:
        [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    };
  }, [ownPosts]);

  const comparison = summary
    ? compareBenchmarks(ownSummary, summary)
    : null;

  return (
    <div>
      <PageHeader
        title="競合ベンチマーク"
        description="競合投稿を登録し、自アカウントとの表示数・反応率・投稿形式を比較します。"
      />

      {error ? (
        <Panel className="mb-6 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </Panel>
      ) : null}

      {message ? (
        <Panel className="mb-6 border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-700">{message}</p>
        </Panel>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-6">
          <Panel>
            <h2 className="font-semibold">競合アカウント登録</h2>
            <form className="mt-4 space-y-4" onSubmit={addCompetitor}>
              <div>
                <label>名称</label>
                <input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label>ユーザー名</label>
                <input className="mt-1" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <Button type="submit">登録</Button>
            </form>

            <div className="mt-6">
              <label>比較する競合</label>
              <select
                className="mt-1"
                value={selectedId}
                onChange={(event) => void loadCompetitor(event.target.value)}
              >
                <option value="">選択してください</option>
                {competitors.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}（@{item.username}）
                  </option>
                ))}
              </select>
            </div>
          </Panel>

          <Panel>
            <h2 className="font-semibold">競合投稿を登録</h2>
            <form className="mt-4 space-y-3" onSubmit={addCompetitorPost}>
              <div>
                <label>投稿日</label>
                <input
                  className="mt-1"
                  type="date"
                  value={form.postedAt}
                  onChange={(e) => setForm({ ...form, postedAt: e.target.value })}
                />
              </div>
              <div>
                <label>投稿形式</label>
                <select
                  className="mt-1"
                  value={form.postType}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      postType: e.target.value as typeof form.postType,
                    })
                  }
                >
                  <option value="reel">リール</option>
                  <option value="image">画像</option>
                  <option value="carousel">カルーセル</option>
                  <option value="video">動画</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="表示数" value={form.views} onChange={(views) => setForm({ ...form, views })} />
                <NumberField label="いいね" value={form.likes} onChange={(likes) => setForm({ ...form, likes })} />
                <NumberField label="コメント" value={form.comments} onChange={(comments) => setForm({ ...form, comments })} />
                <NumberField label="保存" value={form.saves} onChange={(saves) => setForm({ ...form, saves })} />
                <NumberField label="シェア" value={form.shares} onChange={(shares) => setForm({ ...form, shares })} />
              </div>
              <div>
                <label>ハッシュタグ</label>
                <input
                  className="mt-1"
                  value={form.hashtags}
                  onChange={(e) => setForm({ ...form, hashtags: e.target.value })}
                  placeholder="#工作 #段ボール"
                />
              </div>
              <div>
                <label>キャプション</label>
                <textarea
                  className="mt-1"
                  rows={3}
                  value={form.caption}
                  onChange={(e) => setForm({ ...form, caption: e.target.value })}
                />
              </div>
              <Button type="submit" disabled={savingPost || !selectedId}>
                {savingPost ? "登録中..." : "競合投稿を登録"}
              </Button>
            </form>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel>
            <h2 className="font-semibold">自アカウントとの比較</h2>
            {!summary ? (
              <p className="mt-4 text-sm text-stone-600">
                競合を選択し、投稿データを登録すると比較結果が表示されます。
              </p>
            ) : (
              <>
                <div className="mt-4 overflow-x-auto">
                  <table>
                    <thead>
                      <tr>
                        <th>指標</th>
                        <th>自アカウント</th>
                        <th>競合</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>投稿数</td>
                        <td>{ownSummary.posts}</td>
                        <td>{summary.posts}</td>
                      </tr>
                      <tr>
                        <td>平均表示数</td>
                        <td>{Math.round(ownSummary.averageViews).toLocaleString()}</td>
                        <td>{Math.round(summary.averageViews).toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td>平均反応率</td>
                        <td>{ownSummary.engagementRate.toFixed(2)}%</td>
                        <td>{summary.engagementRate}%</td>
                      </tr>
                      <tr>
                        <td>最多投稿形式</td>
                        <td>{ownSummary.topPostType ?? "-"}</td>
                        <td>{summary.topPostType ?? "-"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {comparison ? (
                  <div className="mt-5 rounded-lg bg-skyglass p-4">
                    <h3 className="text-sm font-semibold">比較コメント</h3>
                    <p className="mt-2 text-sm leading-6 text-stone-700">
                      {comparison.comment}
                    </p>
                  </div>
                ) : null}
              </>
            )}
          </Panel>

          <Panel>
            <h2 className="font-semibold">登録済み競合投稿</h2>
            {!competitorPosts.length ? (
              <p className="mt-4 text-sm text-stone-600">
                競合投稿はまだ登録されていません。
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>投稿日</th>
                      <th>形式</th>
                      <th>表示数</th>
                      <th>反応</th>
                    </tr>
                  </thead>
                  <tbody>
                    {competitorPosts.map((post) => (
                      <tr key={post.id}>
                        <td>{post.postedAt}</td>
                        <td>{post.postType}</td>
                        <td>{post.views.toLocaleString()}</td>
                        <td>
                          {post.likes +
                            post.comments +
                            (post.saves ?? 0) +
                            (post.shares ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label>{label}</label>
      <input
        className="mt-1"
        type="number"
        min="0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
