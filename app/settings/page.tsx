"use client";

import { ChangeEvent, useState } from "react";
import { Button, PageHeader, Panel } from "@/components/ui";
import { pullPhpDataToLocal, pushLocalDataToPhp, testPhpBackend } from "@/lib/php-backend";
import { clearLocalData, exportLocalBackup, importLocalBackup, LocalBackup } from "@/lib/storage";

type TestResult = {
  ok: boolean;
  message: string;
  model?: string;
  output?: string;
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [phpLoading, setPhpLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [dataMessage, setDataMessage] = useState("");
  const [phpMessage, setPhpMessage] = useState("");

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

  const runPhpTest = async () => {
    setPhpLoading(true);
    setPhpMessage("");
    try {
      const data = await testPhpBackend();
      setPhpMessage(`PHP接続成功: ${data.phpVersion ? `PHP ${data.phpVersion}` : data.message ?? "起動中"}`);
    } catch {
      setPhpMessage("PHP接続失敗: php-backendを起動してから再度試してください。");
    } finally {
      setPhpLoading(false);
    }
  };

  const saveToPhp = async () => {
    setPhpLoading(true);
    setPhpMessage("");
    try {
      const data = await pushLocalDataToPhp();
      const accountCount = data.counts?.accounts ?? 0;
      const postCount = data.counts?.posts ?? 0;
      setPhpMessage(`PHPへ保存しました。アカウント${accountCount}件、投稿${postCount}件。`);
    } catch {
      setPhpMessage("PHPへの保存に失敗しました。PHPサーバーが起動しているか確認してください。");
    } finally {
      setPhpLoading(false);
    }
  };

  const loadFromPhp = async () => {
    if (!window.confirm("PHP側の保存データでブラウザ内データを上書きしますか？")) return;
    setPhpLoading(true);
    setPhpMessage("");
    try {
      const backup = await pullPhpDataToLocal();
      setPhpMessage(`PHPから復元しました。アカウント${backup.accounts.length}件、投稿${backup.posts.length}件。画面を再読み込みしてください。`);
    } catch {
      setPhpMessage("PHPからの復元に失敗しました。PHPサーバーが起動しているか確認してください。");
    } finally {
      setPhpLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="設定" description="OpenAI APIキーの設定状態と接続を確認できます。" />
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
          <p className="mt-2 text-sm leading-6 text-stone-600">`.env.local` に以下を設定してください。</p>
          <pre className="mt-3 overflow-auto rounded-md bg-stone-100 p-3 text-xs">{`OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini`}</pre>
          <p className="mt-3 text-sm leading-6 text-stone-600">設定後はサーバーを再起動すると反映されます。</p>
        </Panel>
      </div>
      <Panel className="mt-6">
        <h2 className="font-semibold">データ管理</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          アカウントと投稿データをJSONでバックアップできます。ブラウザ保存のため、定期的に書き出してください。
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={downloadBackup}>バックアップを書き出す</Button>
          <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold text-ink hover:border-moss">
            バックアップを復元
            <input className="hidden" type="file" accept="application/json,.json" onChange={restoreBackup} />
          </label>
          <Button variant="secondary" onClick={resetData}>全データ削除</Button>
        </div>
        {dataMessage ? <p className="mt-4 rounded-md bg-skyglass px-3 py-2 text-sm text-ink">{dataMessage}</p> : null}
      </Panel>
      <Panel className="mt-6">
        <h2 className="font-semibold">PHPバックエンド連携</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          PHPサーバーを起動すると、登録データをPHP側のJSONファイルへ保存・復元できます。将来、MySQLやPostgreSQLへ移行するための入口として使えます。
        </p>
        <pre className="mt-3 overflow-auto rounded-md bg-stone-100 p-3 text-xs">{`cd php-backend
php -S 127.0.0.1:8080 router.php`}</pre>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={runPhpTest} disabled={phpLoading}>
            {phpLoading ? "確認中..." : "PHP接続をテスト"}
          </Button>
          <Button onClick={saveToPhp} disabled={phpLoading}>PHPへ保存</Button>
          <Button variant="secondary" onClick={loadFromPhp} disabled={phpLoading}>PHPから復元</Button>
        </div>
        {phpMessage ? <p className="mt-4 rounded-md bg-skyglass px-3 py-2 text-sm text-ink">{phpMessage}</p> : null}
      </Panel>
    </div>
  );
}
