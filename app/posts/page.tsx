"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ButtonLink, PageHeader, Panel } from "@/components/ui";
import { loadAccounts, loadPosts } from "@/lib/storage";
import { InstagramAccount, InstagramPost, PostType } from "@/lib/types";
import { formatPercent, getMetrics, postTypeLabels } from "@/lib/metrics";

type SortKey = "date" | "recordedDate" | "likes" | "saves" | "views" | "engagementRate";

export default function PostsPage() {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [sort, setSort] = useState<SortKey>("date");
  const [type, setType] = useState<PostType | "all">("all");
  const [accountId, setAccountId] = useState("all");

  useEffect(() => {
    setPosts(loadPosts());
    setAccounts(loadAccounts());
  }, []);

  const filtered = useMemo(() => {
    return posts
      .filter((post) => accountId === "all" || post.accountId === accountId)
      .filter((post) => type === "all" || post.type === type)
      .sort((a, b) => {
        if (sort === "date") return new Date(b.date).getTime() - new Date(a.date).getTime();
        if (sort === "recordedDate") return new Date(b.recordedDate ?? b.date).getTime() - new Date(a.recordedDate ?? a.date).getTime();
        if (sort === "engagementRate") return getMetrics(b).engagementRate - getMetrics(a).engagementRate;
        return b[sort] - a[sort];
      });
  }, [posts, sort, type, accountId]);

  const accountNameById = useMemo(() => Object.fromEntries(accounts.map((account) => [account.id, account.name])), [accounts]);

  return (
    <div>
      <PageHeader title="投稿一覧" description="登録済み投稿を表で確認し、成果順に並び替えできます。" action={<ButtonLink href="/posts/new">投稿を追加</ButtonLink>} />
      <Panel>
        <div className="mb-4 grid gap-3 md:grid-cols-3">
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
        </div>
        <div className="overflow-auto">
          <table>
            <thead>
              <tr>
                <th>投稿日</th>
                <th>データ登録日</th>
                <th>アカウント</th>
                <th>タイプ</th>
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
      </Panel>
    </div>
  );
}

function formatDateTime(value?: string) {
  if (!value) return "未記録";
  return new Date(value).toLocaleString("ja-JP");
}
