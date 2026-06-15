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
  memo: ""
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const refresh = async () => setAccounts(await loadAccountsData());

  useEffect(() => {
    refresh();
  }, []);

  const setValue = (key: keyof InstagramAccountInput, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const input = { ...form, username: form.username.replace(/^@/, "") };
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
    await deleteAccountData(account.id);
    if (editingId === account.id) cancelEdit();
    setMessage("アカウントを削除しました。");
    await refresh();
  };

  const addSamples = async () => {
    await upsertAccountsData(sampleAccounts);
    setMessage("サンプルアカウントを追加しました。");
    await refresh();
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
            <div className="md:col-span-2">
              <label>メモ</label>
              <textarea rows={3} value={form.memo} onChange={(e) => setValue("memo", e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Button type="submit">{editingId ? "変更を保存" : "登録する"}</Button>
              {editingId ? <Button variant="secondary" onClick={cancelEdit}>キャンセル</Button> : null}
              <Button variant="secondary" onClick={addSamples}>サンプルアカウントを追加</Button>
            </div>
          </form>
          {message ? <p className="mt-4 rounded-md bg-skyglass px-3 py-2 text-sm text-ink">{message}</p> : null}
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
