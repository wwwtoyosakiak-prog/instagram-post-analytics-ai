"use client";

import { FormEvent, useEffect, useState } from "react";
import { User } from "lucide-react";
import { Button, PageHeader, Panel } from "@/components/ui";
import { addAccountData, loadAccountsData, updateAccountData } from "@/lib/cloud-storage";
import { InstagramAccount, InstagramAccountInput } from "@/lib/types";

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

const emptyForm: InstagramAccountInput = {
  name: "",
  username: "",
  instagramApiUsername: "",
  profileUrl: "",
  industry: "",
  targetAudience: "",
  goal: "",
  openaiApiKeyEnvName: "",
  openaiModel: "",
  analysisInstructions: "",
  memo: ""
};

function fmt(n: number | null | undefined) {
  if (n == null) return "–";
  return n >= 10000
    ? `${(n / 10000).toFixed(1)}万`
    : n.toLocaleString("ja-JP");
}

export default function AccountPage() {
  const [account, setAccount] = useState<InstagramAccount | null>(null);
  const [graphAccount, setGraphAccount] = useState<GraphApiAccount | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<InstagramAccountInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      loadAccountsData(),
      fetch("/api/instagram/dashboard").then((r) => r.ok ? r.json() : null).catch(() => null)
    ]).then(([accounts, dashData]) => {
      const list = Array.isArray(accounts) ? accounts : [];
      const acc = list[0] ?? null;
      setAccount(acc);
      if (acc) {
        setForm({
          name: acc.name,
          username: acc.username,
          instagramApiUsername: acc.instagramApiUsername ?? "",
          profileUrl: acc.profileUrl,
          industry: acc.industry,
          targetAudience: acc.targetAudience,
          goal: acc.goal,
          openaiApiKeyEnvName: acc.openaiApiKeyEnvName ?? "",
          openaiModel: acc.openaiModel ?? "",
          analysisInstructions: acc.analysisInstructions ?? "",
          memo: acc.memo
        });
      } else {
        setEditing(true);
      }
      if (dashData?.account) {
        const snaps: { followers_count?: number }[] = dashData.follower_snapshots ?? [];
        const lastSnap = snaps[snaps.length - 1];
        const followers = dashData.account.followers_count || lastSnap?.followers_count || null;
        setGraphAccount({ ...dashData.account, followers_count: followers } as GraphApiAccount);
      }
      setLoading(false);
    });
  }, []);

  const setValue = (key: keyof InstagramAccountInput, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const input = { ...form, username: form.username.replace(/^@/, "") };
    try {
      if (account) {
        await updateAccountData(account.id, input);
        setMessage("アカウント情報を更新しました。");
      } else {
        await addAccountData(input);
        setMessage("アカウント情報を登録しました。");
      }
      const updated = await loadAccountsData();
      setAccount(updated[0] ?? null);
      setEditing(false);
    } catch (caught) {
      setMessage("");
      setError(caught instanceof Error ? `保存に失敗しました: ${caught.message}` : "保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageHeader title="アカウント情報" description="読み込み中..." />;

  const displayName = graphAccount?.name || account?.name || "アカウント未登録";
  const displayUsername = graphAccount?.username || account?.username;

  return (
    <div>
      <PageHeader title="アカウント情報" description="連携中のInstagramアカウントの情報を確認できます。" />

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

            {/* 統計 */}
            <div className="mt-5 flex gap-8">
              <Stat label="投稿" value={fmt(graphAccount?.media_count)} />
              <Stat label="フォロワー" value={fmt(graphAccount?.followers_count)} />
              <Stat label="フォロー中" value={fmt(graphAccount?.follows_count)} />
            </div>

            {/* bio */}
            {graphAccount?.biography && (
              <p className="mt-4 text-sm leading-6 text-stone-700 whitespace-pre-wrap max-w-lg">
                {graphAccount.biography}
              </p>
            )}

            {/* website */}
            {graphAccount?.website && (
              <a
                href={graphAccount.website}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-sm text-sky-600 hover:underline break-all"
              >
                {graphAccount.website}
              </a>
            )}
          </div>
        </div>

        {/* フッター部 */}
        <div className="flex items-center justify-between gap-4 border-t border-stone-100 px-6 py-3">
          {graphAccount?.last_synced_at ? (
            <p className="text-xs text-stone-400">
              最終同期: {new Date(graphAccount.last_synced_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
            </p>
          ) : (
            <p className="text-xs text-stone-400">未同期</p>
          )}
          {!editing && (
            <Button variant="secondary" onClick={() => { setEditing(true); setMessage(""); }}>
              登録情報を編集
            </Button>
          )}
        </div>
      </div>

      {/* Graph API 未連携の案内 */}
      {!graphAccount && !loading && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          フォロワー数・プロフィール画像・bioを表示するには、ダッシュボードから Instagram データを同期してください。
        </div>
      )}

      {/* 編集フォーム（展開式） */}
      {editing && (
        <Panel className="mt-6">
          <h2 className="mb-4 font-semibold">{account ? "登録情報を編集" : "アカウントを登録"}</h2>
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
            <div>
              <label>アカウント名</label>
              <input value={form.name} onChange={(e) => setValue("name", e.target.value)} required />
            </div>
            <div>
              <label>ユーザー名</label>
              <input value={form.username} onChange={(e) => setValue("username", e.target.value)} required />
            </div>
            <div className="md:col-span-2">
              <label>プロフィールURL</label>
              <input value={form.profileUrl} onChange={(e) => setValue("profileUrl", e.target.value)} placeholder="https://www.instagram.com/..." />
            </div>
            <div>
              <label>業種</label>
              <input value={form.industry} onChange={(e) => setValue("industry", e.target.value)} placeholder="アウトドア用品、飲食店、美容室など" />
            </div>
            <div>
              <label>運用目的</label>
              <input value={form.goal} onChange={(e) => setValue("goal", e.target.value)} placeholder="認知拡大、来店、EC流入など" />
            </div>
            <div className="md:col-span-2">
              <label>ターゲット</label>
              <textarea rows={3} value={form.targetAudience} onChange={(e) => setValue("targetAudience", e.target.value)} />
            </div>
            <div className="md:col-span-2 rounded-md border border-stone-200 bg-fog/80 p-4">
              <h3 className="font-semibold">AI/API設定</h3>
              <p className="mt-1 text-sm leading-6 text-stone-600">APIキー本体は保存しません。`.env.local` やVercelに設定した環境変数名だけを登録します。</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label>Instagram APIユーザー名</label>
                  <input value={form.instagramApiUsername} onChange={(e) => setValue("instagramApiUsername", e.target.value)} placeholder="例: tamaenergycircle" />
                </div>
                <div>
                  <label>APIキー環境変数名</label>
                  <input value={form.openaiApiKeyEnvName} onChange={(e) => setValue("openaiApiKeyEnvName", e.target.value)} placeholder="例: OPENAI_API_KEY" />
                </div>
                <div>
                  <label>使用モデル</label>
                  <input value={form.openaiModel} onChange={(e) => setValue("openaiModel", e.target.value)} placeholder="未設定なら OPENAI_MODEL または gpt-4.1-mini" />
                </div>
                <div className="md:col-span-2">
                  <label>AI分析方針</label>
                  <textarea
                    rows={4}
                    value={form.analysisInstructions}
                    onChange={(e) => setValue("analysisInstructions", e.target.value)}
                    placeholder="例: 来店予約につながる改善案を優先。ブランドの上品さを崩さない表現で提案する。"
                  />
                </div>
              </div>
            </div>
            <div className="md:col-span-2">
              <label>メモ</label>
              <textarea rows={3} value={form.memo} onChange={(e) => setValue("memo", e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Button type="submit" disabled={saving}>{saving ? "保存中..." : account ? "変更を保存" : "登録する"}</Button>
              {account && (
                <Button variant="secondary" onClick={() => { setEditing(false); setError(""); }}>
                  キャンセル
                </Button>
              )}
            </div>
          </form>
          {message ? <p className="mt-4 rounded-md bg-skyglass px-3 py-2 text-sm text-ink">{message}</p> : null}
          {error ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm leading-6 text-red-800">{error}</p> : null}
        </Panel>
      )}

      {message && !editing ? (
        <p className="mt-4 rounded-md bg-skyglass px-3 py-2 text-sm text-ink">{message}</p>
      ) : null}
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
