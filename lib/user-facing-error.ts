export type ErrorContext = "sync" | "token" | "analysis" | "save" | "load";

const fallbackMessages: Record<ErrorContext, string> = {
  sync: "Instagramのデータを取得できませんでした。接続状態を確認して、もう一度お試しください。",
  token: "Instagramの接続状態を確認できませんでした。少し待ってから、もう一度お試しください。",
  analysis: "分析を完了できませんでした。少し待ってから、もう一度お試しください。",
  save: "保存できませんでした。入力内容を確認して、もう一度お試しください。",
  load: "データを読み込めませんでした。少し待ってから、もう一度お試しください。",
};

export function toUserFacingError(error: unknown, context: ErrorContext) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  if (/timeout|timed out|abort|時間/.test(normalized)) {
    return "処理に時間がかかっています。少し待ってから、もう一度お試しください。";
  }
  if (/network|fetch|通信|internet|econn|enotfound/.test(normalized)) {
    return "通信できませんでした。インターネット接続を確認して、もう一度お試しください。";
  }
  if (/401|403|unauthorized|forbidden|permission|access token|トークン|認証/.test(normalized)) {
    return "Instagramとの接続を確認できませんでした。Instagram連携画面で接続状態を確認してください。";
  }
  if (/429|rate limit|too many/.test(normalized)) {
    return "利用が集中しています。少し待ってから、もう一度お試しください。";
  }
  if (/supabase|database|環境変数|未接続|not configured|server storage/.test(normalized)) {
    return "データの保存先に接続できませんでした。しばらく待ってから、もう一度お試しください。";
  }

  return fallbackMessages[context];
}
