import { readDataDeletionStatus } from "@/lib/instagram-data-deletion";

type StatusPageProps = { searchParams: Promise<{ code?: string }> };

export default async function DataDeletionStatusPage({ searchParams }: StatusPageProps) {
  const { code = "" } = await searchParams;
  const deletion = /^[a-f0-9]{32}$/.test(code) ? await readDataDeletionStatus(code) : null;
  const statusLabel = deletion?.status === "completed" ? "削除完了" : deletion?.status === "failed" ? "確認が必要" : deletion ? "処理中" : "確認できません";
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-20">
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-gray-500">Instagram投稿分析AI</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">データ削除リクエスト</h1>
        <p className="mt-4 text-gray-600">Instagramから受け取ったデータの削除状況を確認できます。</p>
        <p className="mt-6 text-xl font-semibold text-gray-900">{statusLabel}</p>
        <div className="mt-6 rounded-xl bg-gray-50 p-4">
          <p className="text-sm text-gray-500">確認コード</p>
          <p className="mt-1 break-all font-mono text-sm text-gray-900">{code || "確認コードが指定されていません"}</p>
        </div>
        {deletion?.completed_at ? <p className="mt-4 text-sm text-gray-500">完了日時: {new Date(deletion.completed_at).toLocaleString("ja-JP")}</p> : null}
      </div>
    </main>
  );
}
