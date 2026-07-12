"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button, PageHeader, Panel } from "@/components/ui";

type Competitor = {
  id: string;
  name: string;
  username: string;
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

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");

  async function loadCompetitors() {
    const response = await fetch("/api/competitors", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "取得に失敗しました。");
    setCompetitors(data.competitors ?? []);
  }

  useEffect(() => {
    void loadCompetitors().catch((caught) =>
      setError(caught instanceof Error ? caught.message : "取得に失敗しました。"),
    );
  }, []);

  async function addCompetitor(event: FormEvent) {
    event.preventDefault();
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
    await loadCompetitors();
  }

  async function selectCompetitor(id: string) {
    setSelectedId(id);

    if (!id) {
      setSummary(null);
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
  }

  return (
    <div>
      <PageHeader
        title="競合ベンチマーク"
        description="公開情報や手入力データを使って競合投稿の傾向を比較します。"
      />

      {error ? (
        <Panel className="mb-6 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </Panel>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
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
              onChange={(event) => void selectCompetitor(event.target.value)}
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
          <h2 className="font-semibold">競合サマリー</h2>
          {!summary ? (
            <p className="mt-4 text-sm text-stone-600">
              競合を選択すると、投稿数・平均表示数・反応率などを表示します。
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Stat label="投稿数" value={`${summary.posts}件`} />
              <Stat label="合計表示数" value={summary.totalViews.toLocaleString()} />
              <Stat label="平均表示数" value={summary.averageViews.toLocaleString()} />
              <Stat label="平均反応数" value={summary.averageInteractions.toLocaleString()} />
              <Stat label="平均反応率" value={`${summary.engagementRate}%`} />
              <Stat label="最多形式" value={summary.topPostType ?? "-"} />
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-fog p-4">
      <p className="text-xs font-semibold text-stone-500">{label}</p>
      <p className="mt-2 text-xl font-bold">{value}</p>
    </div>
  );
}
