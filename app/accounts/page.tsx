"use client";

import { useEffect, useState } from "react";
import { User } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { loadAccountsData } from "@/lib/cloud-storage";
import { InstagramAccount } from "@/lib/types";

interface GraphApiAccount {
  name: string;
  username: string;
  followers_count: number | null;
  follows_count: number | null;
  media_count: number | null;
  biography: string | null;
  profile_picture_url: string | null;
  website: string | null;
  last_synced_at: string | null;
}

function fmt(n: number | null | undefined) {
  if (n == null) return "–";
  return n >= 10000
    ? `${(n / 10000).toFixed(1)}万`
    : n.toLocaleString("ja-JP");
}

export default function AccountPage() {
  const [account, setAccount] = useState<InstagramAccount | null>(null);
  const [graphAccount, setGraphAccount] = useState<GraphApiAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      loadAccountsData(),
      fetch("/api/instagram/dashboard").then((r) => r.ok ? r.json() : null).catch(() => null)
    ]).then(([accounts, dashData]) => {
      const list = Array.isArray(accounts) ? accounts : [];
      const acc = list[0] ?? null;
      setAccount(acc);
      if (dashData?.account) {
        type Snap = { followers_count?: number | null; follows_count?: number | null; media_count?: number | null };
        const snaps: Snap[] = dashData.follower_snapshots ?? [];
        const lastSnap = snaps[snaps.length - 1];
        const followers  = dashData.account.followers_count  || lastSnap?.followers_count  || null;
        const follows    = dashData.account.follows_count    || lastSnap?.follows_count    || null;
        const mediaCount = dashData.account.media_count      || lastSnap?.media_count      || (dashData.totals?.posts ?? null);
        setGraphAccount({
          ...dashData.account,
          followers_count: followers,
          follows_count:   follows,
          media_count:     mediaCount,
        } as GraphApiAccount);
      }
      setLoading(false);
    });
  }, []);

  if (loading) return <PageHeader title="プロフィール" description="読み込み中..." />;

  const displayName = graphAccount?.name || account?.name || "アカウント未登録";
  const displayUsername = graphAccount?.username || account?.username;

  return (
    <div>
      <PageHeader title="プロフィール" description="連携中のInstagramプロフィールとAPI同期済み情報を確認できます。" />

      {/* プロフィールカード */}
      <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        {/* ヘッダー部 */}
        <div className="flex flex-col gap-6 p-6 md:flex-row md:items-start md:gap-10">
          {/* プロフィール画像 */}
          <div className="shrink-0 flex justify-center md:justify-start">
            {graphAccount?.profile_picture_url ? (
              <img
                src={graphAccount.profile_picture_url}
                alt="プロフィール画像"
                className="h-28 w-28 rounded-full border-2 border-stone-200 object-cover md:h-36 md:w-36"
              />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-full bg-stone-100 border-2 border-stone-200 md:h-36 md:w-36">
                <User size={48} className="text-stone-400" />
              </div>
            )}
          </div>

          {/* アカウント情報 */}
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-stone-900 leading-tight">{displayName}</h2>
            {displayUsername && (
              <a
                href={`https://www.instagram.com/${displayUsername}/`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-base text-pink-500 hover:underline"
              >
                @{displayUsername}
              </a>
            )}

            {/* bio */}
            {graphAccount?.biography && (
              <p className="mt-3 text-sm leading-6 text-stone-700 whitespace-pre-wrap max-w-lg">
                {graphAccount.biography}
              </p>
            )}

            {/* website */}
            {graphAccount?.website && (
              <a
                href={graphAccount.website}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-sm text-sky-600 hover:underline break-all"
              >
                {graphAccount.website}
              </a>
            )}

            {/* 統計 */}
            <div className="mt-5 flex gap-8">
              <Stat label="投稿" value={fmt(graphAccount?.media_count)} />
              <Stat label="フォロワー" value={fmt(graphAccount?.followers_count)} />
              <Stat label="フォロー中" value={fmt(graphAccount?.follows_count)} />
            </div>
          </div>
        </div>

        {/* フッター部 */}
        <div className="flex items-center justify-between gap-4 border-t border-stone-100 px-6 py-3">
          {graphAccount?.last_synced_at ? (
            <p className="text-xs text-stone-400">
              最終同期: {new Date(graphAccount.last_synced_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
            </p>
          ) : (
            <p className="text-xs text-stone-400">ダッシュボードのAPI同期でプロフィール情報が更新されます</p>
          )}
        </div>
      </div>

      {/* Graph API 未連携の案内 */}
      {!graphAccount && !loading && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          フォロワー数・プロフィール画像・bioを表示するには、ダッシュボードからInstagramデータを同期してください。
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-xl font-bold text-stone-900 leading-tight">{value}</p>
      <p className="mt-0.5 text-xs text-stone-500">{label}</p>
    </div>
  );
}
