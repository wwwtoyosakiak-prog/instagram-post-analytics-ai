"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button, PageHeader, Panel } from "@/components/ui";
import { addAccountData, loadAccountsData, updateAccountData } from "@/lib/cloud-storage";
import { InstagramAccount, InstagramAccountInput } from "@/lib/types";

interface GraphApiAccount {
  name: string;
  username: string;
  followers_count: number | null;
  biography: string | null;
  profile_picture_url: string | null;
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
      const accounts = await loadAccountsData();
      const updated = accounts[0] ?? null;
      setAccount(updated);
      setEditing(false);
    } catch (caught) {
      setMessage("");
      setError(caught instanceof Error ? `保存に失敗しました: ${caught.message}` : "保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageHeader title="アカウント情報" description="読み込み中..." />;

  return (
    <div>
      <PageHeader
        title="アカウント情報"
        description="Instagramアカウントの設定・AI分析方針を確認・編集できます。"
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Graph API 取得情報 */}
          {graphAccount && (
            <Panel>
              <h2 className="mb-4 font-semibold">Instagram アカウント（API取得）</h2>
              <div className="flex items-center gap-4">
                {graphAccount.profile_picture_url && (
                  <img
                    src={graphAccount.profile_picture_url}
                    alt="プロフィール画像"
                    className="h-20 w-20 rounded-full border border-stone-200 object-cover"
                  />
                )}
                <div>
                  <p className="text-xl font-bold text-ink">{graphAccount.name}</p>
                  <a
                    href={`https://www.instagram.com/${graphAccount.username}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-pink-500 hover:underline"
                  >
                    @{graphAccount.username}
                  </a>
                  <p className="mt-1 text-sm font-semibold text-moss">
                    {graphAccount.followers_count != null
                      ? `フォロワー ${graphAccount.followers_count.toLocaleString("ja-JP")} 人`
                      : "フォロワー数 未取得"}
                  </p>
                </div>
              </div>
              {graphAccount.biography && (
                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-stone-700 border-t border-stone-100 pt-4">
                  {graphAccount.biography}
                </p>
              )}
              {graphAccount.last_synced_at && (
                <p className="mt-3 text-xs text-stone-400">
                  最終同期: {new Date(graphAccount.last_synced_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                </p>
              )}
            </Panel>
          )}

          {/* 登録済みアカウント情報 */}
          {account && !editing && (
            <Panel>
              <div className="flex items-start justify-between gap-4">
                <h2 className="font-semibold">登録情報</h2>
                <Button variant="secondary" onClick={() => { setEditing(true); setMessage(""); }}>編集</Button>
              </div>
              <dl className="mt-4 grid gap-3 text-sm">
                <InfoRow label="アカウント名" value={account.name} />
                <InfoRow label="ユーザー名" value={`@${account.username}`} href={`https://www.instagram.com/${account.username}/`} />
                {account.profileUrl && <InfoRow label="プロフィールURL" value={account.profileUrl} />}
                {account.industry && <InfoRow label="業種" value={account.industry} />}
                {account.goal && <InfoRow label="運用目的" value={account.goal} />}
                {account.targetAudience && <InfoRow label="ターゲット" value={account.targetAudience} />}
                {account.memo && <InfoRow label="メモ" value={account.memo} />}
              </dl>
              <div className="mt-5 rounded-md border border-stone-200 bg-fog/80 p-4">
                <p className="text-sm font-semibold">AI/API設定</p>
                <dl className="mt-3 grid gap-2 text-sm">
                  <InfoRow label="Instagram APIユーザー名" value={account.instagramApiUsername || "未設定"} />
                  <InfoRow label="APIキー環境変数名" value={account.openaiApiKeyEnvName || "共通設定を使用"} />
                  <InfoRow label="使用モデル" value={account.openaiModel || "共通設定を使用"} />
                  {account.analysisInstructions && (
                    <InfoRow label="AI分析方針" value={account.analysisInstructions} />
                  )}
                </dl>
              </div>
              <p className="mt-4 text-xs text-stone-400">
                登録: {new Date(account.createdAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                {account.updatedAt && account.updatedAt !== account.createdAt && (
                  <> / 更新: {new Date(account.updatedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</>
                )}
              </p>
            </Panel>
          )}

          {/* 編集フォーム */}
          {editing && (
            <Panel>
              <h2 className="mb-4 font-semibold">{account ? "アカウント情報を編集" : "アカウントを登録"}</h2>
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
                  {account && <Button variant="secondary" onClick={() => { setEditing(false); setError(""); }}>キャンセル</Button>}
                </div>
              </form>
              {message ? <p className="mt-4 rounded-md bg-skyglass px-3 py-2 text-sm text-ink">{message}</p> : null}
              {error ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm leading-6 text-red-800">{error}</p> : null}
            </Panel>
          )}

          {message && !editing ? <p className="rounded-md bg-skyglass px-3 py-2 text-sm text-ink">{message}</p> : null}
        </div>

        {/* 右カラム：補足情報 */}
        <aside className="space-y-4">
          <Panel>
            <h2 className="font-semibold">このページについて</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              Instagramアカウントの基本情報とAI分析の設定を管理します。
              左側の「登録情報」にある「編集」ボタンから変更できます。
            </p>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              上部の「Instagram アカウント（API取得）」欄はGraph APIで同期した最新情報です。
              ダッシュボードから同期を実行すると更新されます。
            </p>
          </Panel>
          {!graphAccount && (
            <Panel>
              <h2 className="font-semibold">Graph API 未連携</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                フォロワー数・プロフィール画像・bioはInstagram Graph APIを連携すると自動表示されます。
                ダッシュボードから同期を実行してください。
              </p>
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}

function InfoRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-40 shrink-0 font-semibold text-stone-600">{label}</dt>
      <dd className="leading-6 text-ink break-all">
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="text-pink-500 hover:underline">
            {value}
          </a>
        ) : value}
      </dd>
    </div>
  );
}
