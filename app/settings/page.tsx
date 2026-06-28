"use client";

import { useEffect, useState } from "react";
import { ButtonLink, PageHeader, Panel } from "@/components/ui";
import { loadAccountsData } from "@/lib/cloud-storage";
import { InstagramAccount } from "@/lib/types";

export default function SettingsPage() {
  const [account, setAccount] = useState<InstagramAccount | null>(null);

  useEffect(() => {
    loadAccountsData().then((accounts) => {
      if (accounts[0]) setAccount(accounts[0]);
    });
  }, []);

  return (
    <div>
      <PageHeader title="設定" description="一アカウント運用のため、このページでは登録や編集は行いません。" />
      <Panel className="mt-6">
        <h2 className="font-semibold">現在の連携アカウント</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">このプロジェクトは一アカウント専用です。アカウント登録フォームは表示せず、現在の連携先だけを確認できます。</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label>アカウント名</label>
            <div className="rounded-md border border-stone-200 bg-white px-4 py-3 text-base text-ink">
              {account?.name || "未設定"}
            </div>
          </div>
          <div>
            <label>ユーザー名</label>
            <div className="rounded-md border border-stone-200 bg-white px-4 py-3 text-base text-ink">
              {account?.username || "未設定"}
            </div>
          </div>
          <div className="md:col-span-2">
            <label>プロフィールURL</label>
            <div className="rounded-md border border-stone-200 bg-white px-4 py-3 text-base text-ink">
              {account?.profileUrl || "未設定"}
            </div>
          </div>
          <div>
            <label>Instagram APIユーザー名</label>
            <div className="rounded-md border border-stone-200 bg-white px-4 py-3 text-base text-ink">
              {account?.instagramApiUsername || "未設定"}
            </div>
          </div>
          <div className="md:col-span-2 rounded-md border border-stone-200 bg-fog/80 p-4 text-sm leading-6 text-stone-600">
            アカウントの追加や新規登録は行いません。APIや自動同期の認証情報はトークン管理ページで確認します。
          </div>
        </div>
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
