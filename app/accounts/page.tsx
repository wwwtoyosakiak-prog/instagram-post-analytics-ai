"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Download, ShieldCheck, Upload, User } from "lucide-react";
import { Button, PageHeader, PageLoading, Panel } from "@/components/ui";
import { loadAccountsData, loadPostsData, saveAccountsData, savePostsData } from "@/lib/cloud-storage";
import { ClientApiError, requestJson, requestJsonOr } from "@/lib/client-api";
import { InstagramAccount } from "@/lib/types";
import { getSelectedAccountId, withSelectedAccount } from "@/lib/account-preference";
import { createBackup, parseBackup } from "@/lib/data-backup";
import { freshnessClass, getDataFreshness } from "@/lib/data-freshness";

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
  const [connectionMessage, setConnectionMessage] = useState("");

  useEffect(() => {
    Promise.all([
      loadAccountsData(),
      requestJsonOr<DashboardResponse | null>(withSelectedAccount("/api/instagram/dashboard"), null)
    ]).then(([accounts, dashData]) => {
      const list = Array.isArray(accounts) ? accounts : [];
      const selectedAccountId = getSelectedAccountId();
      const acc = list.find((item) => item.id === selectedAccountId) ?? list[0] ?? null;
      setAccount(acc);
      if (dashData?.account) {
        const snaps = dashData.follower_snapshots ?? [];
        const lastSnap = snaps[snaps.length - 1];
        const followers = dashData.account.followers_count ?? lastSnap?.followers_count ?? null;
        const follows = dashData.account.follows_count ?? lastSnap?.follows_count ?? null;
        const mediaCount = dashData.account.media_count ?? lastSnap?.media_count ?? dashData.totals?.posts ?? null;
        setGraphAccount({
          ...dashData.account,
          followers_count: followers,
          follows_count: follows,
          media_count: mediaCount,
        });
      }
      setConnectionMessage(
        dashData?.configured === false
          ? dashData.message ?? "Instagramデータベースが未接続です。"
          : dashData?.account
            ? ""
            : "Instagramデータはまだありません。ダッシュボードから同期してください。",
      );
      setLoading(false);
    });
  }, []);

  if (loading) return <PageLoading title="プロフィール" description="Instagramプロフィールを準備しています。" layout="profile" />;

  const displayName = graphAccount?.name || account?.name || "アカウント未登録";
  const displayUsername = graphAccount?.username || account?.username;
  const freshness = getDataFreshness(graphAccount?.last_synced_at);

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
              <Image
                src={graphAccount.profile_picture_url}
                alt="プロフィール画像"
                width={144}
                height={144}
                unoptimized
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
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${freshnessClass(freshness.tone)}`} title={freshness.description}>{freshness.label}</span>
        </div>
      </div>

      {/* Graph API 未連携の案内 */}
      {!graphAccount && !loading && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {connectionMessage || "フォロワー数・プロフィール画像・bioを表示するには、ダッシュボードからInstagramデータを同期してください。"}
        </div>
      )}

      <DataProtectionPanel />
    </div>
  );
}

function DataProtectionPanel() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { void fetch("/api/data/backup?automatic=true", { cache: "no-store" }); }, []);

  const exportBackup = async () => {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      let backup: unknown;
      let summary: string;
      try {
        const fullBackup = await requestJson<{ data: Record<string, unknown[]> }>("/api/data/backup");
        backup = fullBackup;
        summary = "プロフィール、投稿、AI分析、インサイト、レポートを書き出しました。";
      } catch (requestError) {
        if (!(requestError instanceof ClientApiError) || requestError.status !== 501) throw requestError;
        const [accounts, posts] = await Promise.all([loadAccountsData(), loadPostsData()]);
        backup = createBackup(accounts, posts);
        summary = `${accounts.length}件のプロフィールと${posts.length}件の投稿を書き出しました。`;
      }
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `instagram-analysis-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage(summary);
    } catch {
      setError("データを書き出せませんでした。時間をおいて再度お試しください。");
    } finally {
      setBusy(false);
    }
  };

  const restoreBackup = async (file: File) => {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const text = await file.text();
      const raw = JSON.parse(text) as { version?: number };
      if (raw.version === 2) {
        const preview = await requestJson<{ totalRows: number }>("/api/data/backup?preview=true", { method: "POST", headers: { "Content-Type": "application/json" }, body: text });
        if (!window.confirm(`${preview.totalRows}件のデータを復元します。現在のデータは復元前バックアップとして保存されます。続けますか？`)) return;
        const result = await requestJson<{ restoredRows: number }>("/api/data/backup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: text,
        });
        setMessage(`${result.restoredRows}件のデータを復元しました。`);
      } else {
        const backup = parseBackup(text);
        await saveAccountsData(backup.accounts);
        await savePostsData(backup.posts);
        setMessage(`${backup.accounts.length}件のプロフィールと${backup.posts.length}件の投稿を復元しました。`);
      }
    } catch {
      setError("このファイルは復元できません。サイトから書き出したバックアップを選んでください。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel className="mt-6">
      <div className="flex items-start gap-3">
        <ShieldCheck size={22} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden />
        <div>
          <h2 className="font-semibold text-ink">データを保護</h2>
          <p className="mt-1 text-sm leading-6 text-stone-600">プロフィール、投稿、AI分析、インサイト、レポートを1つのファイルに保存し、必要なときに戻せます。</p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Button onClick={exportBackup} disabled={busy} variant="secondary">
          <span className="inline-flex items-center gap-2"><Download size={17} aria-hidden />データを書き出す</span>
        </Button>
        <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-moss">
          <Upload size={17} aria-hidden />データを復元
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void restoreBackup(file);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      {message ? <p role="status" className="mt-3 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
    </Panel>
  );
}

interface DashboardResponse {
  configured?: boolean;
  message?: string;
  account?: GraphApiAccount | null;
  follower_snapshots?: Array<{
    followers_count?: number | null;
    follows_count?: number | null;
    media_count?: number | null;
  }>;
  totals?: { posts?: number | null };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-xl font-bold text-stone-900 leading-tight">{value}</p>
      <p className="mt-0.5 text-xs text-stone-500">{label}</p>
    </div>
  );
}
