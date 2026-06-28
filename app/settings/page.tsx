"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button, ButtonLink, PageHeader, Panel } from "@/components/ui";
import { loadAccountsData, updateAccountData } from "@/lib/cloud-storage";
import { InstagramAccount, InstagramAccountInput } from "@/lib/types";

const initialAccountForm: InstagramAccountInput = {
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

export default function SettingsPage() {
  const [account, setAccount] = useState<InstagramAccount | null>(null);
  const [accountForm, setAccountForm] = useState<InstagramAccountInput>(initialAccountForm);
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountMessage, setAccountMessage] = useState("");
  const [accountError, setAccountError] = useState("");

  useEffect(() => {
    loadAccountsData().then((accounts) => {
      if (accounts[0]) {
        setAccount(accounts[0]);
        setAccountForm({
          name: accounts[0].name,
          username: accounts[0].username,
          instagramApiUsername: accounts[0].instagramApiUsername ?? "",
          profileUrl: accounts[0].profileUrl,
          industry: accounts[0].industry,
          targetAudience: accounts[0].targetAudience,
          goal: accounts[0].goal,
          openaiApiKeyEnvName: accounts[0].openaiApiKeyEnvName ?? "",
          openaiModel: accounts[0].openaiModel ?? "",
          analysisInstructions: accounts[0].analysisInstructions ?? "",
          memo: accounts[0].memo
        });
      }
    });
  }, []);

  const setAccountValue = (key: keyof InstagramAccountInput, value: string) => {
    setAccountForm((current) => ({ ...current, [key]: value }));
  };

  const saveAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (!account) {
      setAccountError("既存アカウントが未登録です。新規登録は使わず、既存データを確認してください。");
      return;
    }
    setAccountSaving(true);
    setAccountError("");
    const input = { ...accountForm, username: accountForm.username.replace(/^@/, "") };
    try {
      await updateAccountData(account.id, input);
      setAccountMessage("アカウント情報を更新しました。");
      const accounts = await loadAccountsData();
      if (accounts[0]) setAccount(accounts[0]);
    } catch (caught) {
      setAccountMessage("");
      setAccountError(caught instanceof Error ? `保存に失敗しました: ${caught.message}` : "アカウントの保存に失敗しました。");
    } finally {
      setAccountSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="設定" description="一アカウント運用に必要なプロフィール情報だけを管理できます。" />
      <Panel className="mt-6">
        <h2 className="font-semibold">プロフィール設定</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">このツールで追跡するInstagramアカウントの基本情報と、API連携用のユーザー名だけを管理します。</p>
        <form onSubmit={saveAccount} className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label>アカウント名</label>
            <input value={accountForm.name} onChange={(e) => setAccountValue("name", e.target.value)} required />
          </div>
          <div>
            <label>ユーザー名</label>
            <input value={accountForm.username} onChange={(e) => setAccountValue("username", e.target.value)} required />
          </div>
          <div className="md:col-span-2">
            <label>プロフィールURL</label>
            <input value={accountForm.profileUrl} onChange={(e) => setAccountValue("profileUrl", e.target.value)} placeholder="https://www.instagram.com/..." />
          </div>
          <div>
            <label>Instagram APIユーザー名</label>
            <input value={accountForm.instagramApiUsername} onChange={(e) => setAccountValue("instagramApiUsername", e.target.value)} placeholder="例: tamaenergycircle" />
          </div>
          <div className="md:col-span-2 rounded-md border border-stone-200 bg-fog/80 p-4 text-sm leading-6 text-stone-600">
            APIや自動同期の認証情報はトークン管理ページで確認します。OpenAIやバックアップ関連の詳細設定は通常運用では表示しません。
          </div>
          {account ? (
            <div className="md:col-span-2">
              <Button type="submit" disabled={accountSaving}>{accountSaving ? "保存中..." : "変更を保存"}</Button>
            </div>
          ) : (
            <div className="md:col-span-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              この画面では新規登録を行いません。既存アカウントがある前提で運用します。
            </div>
          )}
        </form>
        {accountMessage ? <p className="mt-4 rounded-md bg-skyglass px-3 py-2 text-sm text-ink">{accountMessage}</p> : null}
        {accountError ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm leading-6 text-red-800">{accountError}</p> : null}
      </Panel>
      <Panel className="mt-6">
        <h2 className="font-semibold">Instagramトークン管理</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          Instagram Graph API の長期アクセストークン状態を確認し、期限切れ前の手動更新を実行できます。トークン本体は表示しません。
        </p>
        <div className="mt-4">
          <ButtonLink href="/token-management">トークン管理を開く</ButtonLink>
        </div>
      </Panel>
    </div>
  );
}
