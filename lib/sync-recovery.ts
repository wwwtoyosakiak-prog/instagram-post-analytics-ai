export type SyncRecovery = { cause: string; nextAction: string; href: string; actionLabel: string };

export function getSyncRecovery(message?: string | null): SyncRecovery {
  const normalized = (message ?? "").toLowerCase();
  if (/token|401|403|unauthorized|permission|認証|権限/.test(normalized)) {
    return { cause: "Instagramの認証または権限を確認できません。", nextAction: "Instagram連携画面で接続テストを行い、失敗する場合は再連携してください。", href: "/token-management", actionLabel: "連携を確認" };
  }
  if (/rate|429|too many|利用.*集中/.test(normalized)) {
    return { cause: "Instagram APIの一時的な利用制限です。", nextAction: "10分ほど待ってから、もう一度データを取得してください。", href: "/dashboard", actionLabel: "同期画面へ" };
  }
  if (/supabase|database|保存|column|table|schema/.test(normalized)) {
    return { cause: "保存先データベースの準備または保存処理に問題があります。", nextAction: "Instagram連携画面の準備状況を確認してください。", href: "/token-management", actionLabel: "準備状況を確認" };
  }
  return { cause: "通信またはInstagram APIで一時的な問題が発生しました。", nextAction: "少し待ってから再取得し、続く場合はInstagram連携の接続テストを行ってください。", href: "/token-management", actionLabel: "接続を確認" };
}
