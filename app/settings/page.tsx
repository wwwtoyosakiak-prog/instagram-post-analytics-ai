"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { Button, ButtonLink, PageHeader, Panel } from "@/components/ui";
import { addAccountData, getServerStorageStatus, loadAccountsData, loadAnalysesData, loadCategoriesData, loadGoalsData, loadMonthlyReportsData, loadPostsData, loadTasksData, pushLocalBackupToServer, updateAccountData } from "@/lib/cloud-storage";
import { exportAccountsCsv, exportAnalysesCsv, exportGoalsCsv, exportMonthlyReportsCsv, exportPostsCsv, exportTasksCsv } from "@/lib/csv";
import { clearLocalData, exportLocalBackup, importLocalBackup, LocalBackup } from "@/lib/storage";
import { InstagramAccount, InstagramAccountInput } from "@/lib/types";

type TestResult = {
  ok: boolean;
  message: string;
  model?: string;
  output?: string;
};

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
  const [loading, setLoading] = useState(false);
  const [serverLoading, setServerLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [dataMessage, setDataMessage] = useState("");
  const [serverMessage, setServerMessage] = useState("");
  const [csvLoading, setCsvLoading] = useState(false);
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
    setAccountSaving(true);
    setAccountError("");
    const input = { ...accountForm, username: accountForm.username.replace(/^@/, "") };
    try {
      if (account) {
        await updateAccountData(account.id, input);
        setAccountMessage("アカウント情報を更新しました。");
      } else {
        await addAccountData(input);
        setAccountMessage("アカウント情報を登録しました。");
      }
      const accounts = await loadAccountsData();
      if (accounts[0]) setAccount(accounts[0]);
    } catch (caught) {
      setAccountMessage("");
      setAccountError(caught instanceof Error ? `保存に失敗しました: ${caught.message}` : "アカウントの保存に失敗しました。");
    } finally {
      setAccountSaving(false);
    }
  };

  const testOpenAi = async () => {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/test-openai", { method: "POST" });
      const data = await response.json();
      setResult({
        ok: response.ok && Boolean(data.ok),
        message: data.message ?? "テスト結果を取得しました。",
        model: data.model,
        output: data.output
      });
    } catch {
      setResult({
        ok: false,
        message: "テストAPIの呼び出しに失敗しました。サーバーが起動しているか確認してください。"
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadBackup = () => {
    const backup = exportLocalBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `instagram-ai-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setDataMessage("バックアップを書き出しました。");
  };

  const restoreBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text()) as LocalBackup;
      importLocalBackup(backup);
      setDataMessage("バックアップを復元しました。画面を再読み込みしてください。");
    } catch {
      setDataMessage("バックアップファイルを読み込めませんでした。");
    } finally {
      event.target.value = "";
    }
  };

  const resetData = () => {
    if (!window.confirm("登録済みのアカウントと投稿をすべて削除しますか？この操作は元に戻せません。")) return;
    clearLocalData();
    setDataMessage("ローカルデータを削除しました。");
  };

  const downloadCsv = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportCsvFiles = async () => {
    setCsvLoading(true);
    setDataMessage("");
    try {
      const exportedAt = new Date().toISOString().slice(0, 10);
      const [accounts, posts, reports, tasks, goals, categories] = await Promise.all([loadAccountsData(), loadPostsData(), loadMonthlyReportsData(), loadTasksData(), loadGoalsData(), loadCategoriesData()]);
      const analyses = (await Promise.all(posts.map((post) => loadAnalysesData(post.id)))).flat();
      const accountNameById = Object.fromEntries(accounts.map((account) => [account.id, account.name]));
      const postById = Object.fromEntries(posts.map((post) => [post.id, post]));

      downloadCsv(exportAccountsCsv(accounts), `instagram-ai-accounts-${exportedAt}.csv`);
      downloadCsv(exportPostsCsv(posts, accountNameById, categories), `instagram-ai-posts-${exportedAt}.csv`);
      downloadCsv(exportAnalysesCsv(analyses, postById, categories), `instagram-ai-analyses-${exportedAt}.csv`);
      downloadCsv(exportMonthlyReportsCsv(reports), `instagram-ai-monthly-reports-${exportedAt}.csv`);
      downloadCsv(exportTasksCsv(tasks, postById, categories), `instagram-ai-tasks-${exportedAt}.csv`);
      downloadCsv(exportGoalsCsv(goals, accountNameById), `instagram-ai-goals-${exportedAt}.csv`);
      setDataMessage(`CSVを書き出しました。アカウント${accounts.length}件、投稿${posts.length}件、AI分析${analyses.length}件、月次レポート${reports.length}件、改善タスク${tasks.length}件、目標${goals.length}件。`);
    } catch {
      setDataMessage("CSVを書き出せませんでした。サーバー保存の設定や通信状態を確認してください。");
    } finally {
      setCsvLoading(false);
    }
  };

  const checkServerStorage = async () => {
    setServerLoading(true);
    try {
      const status = await getServerStorageStatus();
      setServerMessage(status.serverStorageEnabled ? "サーバー保存は有効です。Supabaseに保存されます。" : "サーバー保存は未設定です。現在はブラウザ保存で動作します。");
    } finally {
      setServerLoading(false);
    }
  };

  const migrateLocalData = async () => {
    if (!window.confirm("現在のブラウザ内データをサーバーへ保存しますか？")) return;
    setServerLoading(true);
    try {
      const result = await pushLocalBackupToServer();
      setServerMessage(`サーバーへ移行しました。アカウント${result.accounts}件、投稿${result.posts}件、改善タスク${result.tasks}件、目標${result.goals}件。`);
    } catch {
      setServerMessage("サーバーへの移行に失敗しました。Supabase環境変数とテーブル設定を確認してください。");
    } finally {
      setServerLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="設定" description="アカウント情報・API接続・データ管理を確認・変更できます。" />
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <Panel>
          <h2 className="font-semibold">API連携テスト</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            サーバー側のAPI RouteからOpenAI APIへ短いテストリクエストを送ります。APIキーは画面には表示されません。
          </p>
          <div className="mt-4">
            <Button onClick={testOpenAi} disabled={loading}>
              {loading ? "テスト中..." : "OpenAI API接続をテスト"}
            </Button>
          </div>
          {result ? (
            <div className={`mt-5 rounded-md border p-4 ${result.ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
              <p className={`font-semibold ${result.ok ? "text-emerald-800" : "text-red-800"}`}>
                {result.ok ? "接続成功" : "接続失敗"}
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-700">{result.message}</p>
              {result.model ? <p className="mt-2 text-sm text-stone-600">使用モデル: {result.model}</p> : null}
              {result.output ? <p className="mt-1 text-sm text-stone-600">応答: {result.output}</p> : null}
            </div>
          ) : null}
        </Panel>
        <Panel>
          <h2 className="font-semibold">設定ファイル</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">Vercel Environment Variables に設定し、サーバー側では `process.env` から参照します。</p>
          <pre className="mt-3 overflow-auto rounded-md bg-stone-100 p-3 text-xs">{`OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
INSTAGRAM_ACCESS_TOKEN=ig-long-lived-token
CRON_SECRET=your-random-secret`}</pre>
          <p className="mt-3 text-sm leading-6 text-stone-600">変更後はVercelの再デプロイ、または新しい実行から反映されます。</p>
        </Panel>
      </div>
      <Panel className="mt-6">
        <h2 className="font-semibold">アカウント設定</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">このツールで管理するInstagramアカウントの情報を入力してください。AI分析の精度向上に使われます。</p>
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
            <label>業種</label>
            <input value={accountForm.industry} onChange={(e) => setAccountValue("industry", e.target.value)} placeholder="アウトドア用品、飲食店、美容室など" />
          </div>
          <div>
            <label>運用目的</label>
            <input value={accountForm.goal} onChange={(e) => setAccountValue("goal", e.target.value)} placeholder="認知拡大、来店、EC流入など" />
          </div>
          <div className="md:col-span-2">
            <label>ターゲット</label>
            <textarea rows={3} value={accountForm.targetAudience} onChange={(e) => setAccountValue("targetAudience", e.target.value)} />
          </div>
          <div className="md:col-span-2 rounded-md border border-stone-200 bg-fog/80 p-4">
            <h3 className="font-semibold">AI/API設定</h3>
            <p className="mt-1 text-sm leading-6 text-stone-600">Instagram API連携の紐づけ名と、AI分析に使う環境変数名を管理します。APIキー本体は保存しません。</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label>Instagram APIユーザー名</label>
                <input value={accountForm.instagramApiUsername} onChange={(e) => setAccountValue("instagramApiUsername", e.target.value)} placeholder="例: tamaenergycircle" />
              </div>
              <div>
                <label>APIキー環境変数名</label>
                <input value={accountForm.openaiApiKeyEnvName} onChange={(e) => setAccountValue("openaiApiKeyEnvName", e.target.value)} placeholder="例: OPENAI_API_KEY" />
              </div>
              <div>
                <label>使用モデル</label>
                <input value={accountForm.openaiModel} onChange={(e) => setAccountValue("openaiModel", e.target.value)} placeholder="未設定なら OPENAI_MODEL または gpt-4.1-mini" />
              </div>
              <div className="md:col-span-2">
                <label>AI分析方針</label>
                <textarea rows={4} value={accountForm.analysisInstructions} onChange={(e) => setAccountValue("analysisInstructions", e.target.value)} placeholder="例: 来店予約につながる改善案を優先。ブランドの上品さを崩さない表現で提案する。" />
              </div>
            </div>
          </div>
          <div className="md:col-span-2">
            <label>メモ</label>
            <textarea rows={3} value={accountForm.memo} onChange={(e) => setAccountValue("memo", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={accountSaving}>{accountSaving ? "保存中..." : account ? "変更を保存" : "登録する"}</Button>
          </div>
        </form>
        {accountMessage ? <p className="mt-4 rounded-md bg-skyglass px-3 py-2 text-sm text-ink">{accountMessage}</p> : null}
        {accountError ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm leading-6 text-red-800">{accountError}</p> : null}
      </Panel>
      <Panel className="mt-6">
        <h2 className="font-semibold">データ管理</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          アカウントと投稿データをJSONでバックアップできます。CSV出力では、アカウント、投稿、AI分析結果、月次レポート、改善タスク、目標を社内共有しやすい形式で書き出せます。
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={downloadBackup}>バックアップを書き出す</Button>
          <Button variant="secondary" onClick={exportCsvFiles} disabled={csvLoading}>{csvLoading ? "CSV出力中..." : "CSVをまとめて書き出す"}</Button>
          <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold text-ink hover:border-moss">
            バックアップを復元
            <input className="hidden" type="file" accept="application/json,.json" onChange={restoreBackup} />
          </label>
          <Button variant="secondary" onClick={resetData}>全データ削除</Button>
        </div>
        {dataMessage ? <p className="mt-4 rounded-md bg-skyglass px-3 py-2 text-sm text-ink">{dataMessage}</p> : null}
      </Panel>
      <Panel className="mt-6">
        <h2 className="font-semibold">サーバー保存</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          Supabaseを設定すると、アカウントと投稿データをサーバー側に保存できます。未設定の場合はこれまで通りブラウザ保存で動きます。
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={checkServerStorage} disabled={serverLoading}>
            {serverLoading ? "確認中..." : "サーバー保存状態を確認"}
          </Button>
          <Button variant="secondary" onClick={migrateLocalData} disabled={serverLoading}>ブラウザ内データをサーバーへ移行</Button>
        </div>
        {serverMessage ? <p className="mt-4 rounded-md bg-skyglass px-3 py-2 text-sm text-ink">{serverMessage}</p> : null}
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
