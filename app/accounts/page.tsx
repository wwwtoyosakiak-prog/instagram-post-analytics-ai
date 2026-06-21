"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button, PageHeader, Panel } from "@/components/ui";
import { addAccountData, deleteAccountData, loadAccountsData, updateAccountData, upsertAccountsData } from "@/lib/cloud-storage";
import { InstagramAccount, InstagramAccountInput } from "@/lib/types";
import { sampleAccounts } from "@/lib/sample-data";

const initialForm: InstagramAccountInput = {
  name: "",
  username: "",
  profileUrl: "",
  industry: "",
  targetAudience: "",
  goal: "",
  openaiApiKeyEnvName: "",
  openaiModel: "",
  analysisInstructions: "",
  memo: ""
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = async () => setAccounts(await loadAccountsData());

  useEffect(() => {
    refresh();
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
      if (editingId) {
        await updateAccountData(editingId, input);
        setMessage("アカウントを更新しました。");
      } else {
        await addAccountData(input);
        setMessage("アカウントを登録しました。");
      }
      setForm(initialForm);
      setEditingId(null);
      await refresh();
    } catch (caught) {
      setMessage("");
      setError(caught instanceof Error ? `保存に失敗しました: ${caught.message}` : "アカウントの保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (account: InstagramAccount) => {
    setEditingId(account.id);
    setForm({
      name: account.name,
      username: account.username,
      profileUrl: account.profileUrl,
      industry: account.industry,
      targetAudience: account.targetAudience,
      goal: account.goal,
      openaiApiKeyEnvName: account.openaiApiKeyEnvName ?? "",
      openaiModel: account.openaiModel ?? "",
      analysisInstructions: account.analysisInstructions ?? "",
      memo: account.memo
    });
    setMessage("編集内容を入力して保存してください。");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(initialForm);
    setMessage("");
  };

  const removeAccount = async (account: InstagramAccount) => {
    if (!window.confirm(`${account.name} を削除しますか？投稿データ自体は削除されません。`)) return;
    setError("");
    try {
      await deleteAccountData(account.id);
      if (editingId === account.id) cancelEdit();
      setMessage("アカウントを削除しました。");
      await refresh();
    } catch (caught) {
      setMessage("");
      setError(caught instanceof Error ? `削除に失敗しました: ${caught.message}` : "アカウントの削除に失敗しました。");
    }
  };

  const addSamples = async () => {
    setError("");
    try {
      await upsertAccountsData(sampleAccounts);
      setMessage("サンプルアカウントを追加しました。");
      await refresh();
    } catch (caught) {
      setMessage("");
      setError(caught instanceof Error ? `追加に失敗しました: ${caught.message}` : "サンプルアカウントの追加に失敗しました。");
    }
  };

  return (
    <div>
      <PageHeader title="アカウント登録" description="ブランドや店舗ごとにInstagramアカウントを登録し、業種や運用目的を後から編集できます。" />
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <Panel>
          <h2 className="mb-4 font-semibold">{editingId ? "アカウント編集" : "新規アカウント登録"}</h2>
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
            <div>
              <label>アカウント名</label>
              <input value={form.name} onChange={(e) => setValue("name", e.target.value)} placeholder="OZOPS Outdoor" required />
            </div>
            <div>
              <label>ユーザー名</label>
              <input value={form.username} onChange={(e) => setValue("username", e.target.value)} placeholder="ozops_outdoor" required />
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
              <p className="mt-1 text-sm leading-6 text-stone-600">
                APIキー本体は保存しません。`.env.local` やVercelに設定した環境変数名だけを登録します。未設定の場合は共通の `OPENAI_API_KEY` を使います。
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label>APIキー環境変数名</label>
                  <input value={form.openaiApiKeyEnvName} onChange={(e) => setValue("openaiApiKeyEnvName", e.target.value)} placeholder="例: OPENAI_API_KEY_OZOPS" />
                </div>
                <div>
                  <label>使用モデル</label>
                  <input value={form.openaiModel} onChange={(e) => setValue("openaiModel", e.target.value)} placeholder="未設定なら OPENAI_MODEL または gpt-4.1-mini" />
                </div>
                <div className="md:col-span-2">
                  <label>このアカウント専用の分析方針</label>
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
              <Button type="submit" disabled={saving}>{saving ? "保存中..." : editingId ? "変更を保存" : "登録する"}</Button>
              {editingId ? <Button variant="secondary" onClick={cancelEdit}>キャンセル</Button> : null}
              <Button variant="secondary" onClick={addSamples}>サンプルアカウントを追加</Button>
            </div>
          </form>
          {message ? <p className="mt-4 rounded-md bg-skyglass px-3 py-2 text-sm text-ink">{message}</p> : null}
          {error ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm leading-6 text-red-800">{error}</p> : null}
        </Panel>
        <Panel>
          <h2 className="font-semibold">登録済みアカウント</h2>
          <div className="mt-4 space-y-3">
            {accounts.map((account) => (
              <div key={account.id} className="rounded-md border border-stone-200 p-3">
                <p className="font-semibold">{account.name}</p>
                <p className="text-sm text-stone-600">@{account.username}</p>
                <p className="mt-2 text-sm text-stone-700">{account.industry || "業種未設定"}</p>
                <p className="mt-1 text-sm leading-6 text-stone-600">{account.goal || "目的未設定"}</p>
                <p className="mt-1 text-sm leading-6 text-stone-600">{account.targetAudience || "ターゲット未設定"}</p>
                <div className="mt-3 rounded-md bg-fog px-3 py-2 text-xs leading-5 text-stone-600">
                  <p className="font-semibold text-ink">AI/API設定</p>
                  <p>APIキー: {account.openaiApiKeyEnvName || "共通設定を使用"}</p>
                  <p>モデル: {account.openaiModel || "共通設定を使用"}</p>
                  <p>分析方針: {account.analysisInstructions || "未設定"}</p>
                </div>
                <p className="mt-2 text-xs text-stone-500">登録日時: {formatDateTime(account.createdAt)}</p>
                <p className="mt-1 text-xs text-stone-500">編集日時: {formatDateTime(account.updatedAt ?? account.createdAt)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => startEdit(account)}>編集</Button>
                  <Button variant="secondary" onClick={() => removeAccount(account)}>削除</Button>
                </div>
              </div>
            ))}
            {!accounts.length ? <p className="text-sm text-stone-500">アカウントがありません。</p> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function formatDateTime(value?: string) {
  if (!value) return "未記録";
  return new Date(value).toLocaleString("ja-JP");
}
