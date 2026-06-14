import { InstagramPost } from "@/lib/types";
import { getMetrics, postTypeLabels } from "@/lib/metrics";

export function createSampleAnalysis(post: InstagramPost) {
  const metrics = getMetrics(post);
  const strongSave = metrics.saveRate >= 1.5;
  return {
    firstImpression: `${postTypeLabels[post.type]}として、アウトドア利用シーンが想像しやすい投稿です。`,
    imageMessage: post.screenshot
      ? "スクリーンショットを含めて、商品や利用シーンの視覚情報を分析対象にできます。"
      : "画像未登録のため、今回はキャプションと数値中心の仮分析です。",
    captionClarity: post.caption.length > 45 ? "具体性がありますが、冒頭に結論を置くとさらに伝わりやすくなります。" : "短く読みやすい一方、利用シーンや得られる価値を少し足す余地があります。",
    strengths: `表示数${post.views.toLocaleString()}、保存率${metrics.saveRate.toFixed(2)}%です。${strongSave ? "保存行動が強く、後で見返したい内容として機能しています。" : "認知獲得はできていますが、保存される理由を増やせます。"}`,
    weaknesses: `コメント率は${metrics.commentRate.toFixed(2)}%です。質問や比較軸を入れると会話が増える可能性があります。`,
    reason: `${post.type === "reel" ? "リールは冒頭の引きが表示数に効きやすく、" : "投稿の価値が一目で伝わるかが重要で、"}キャプションの具体性と保存したくなる情報量が成果を左右した可能性があります。`,
    improvements: ["1枚目または冒頭1秒でベネフィットを明示する", "キャプション末尾に質問を入れてコメントを促す", "保存したくなるチェックリストや比較表を追加する"],
    nextIdeas: ["初心者向けキャンプ道具チェックリスト", "30秒でわかる設営手順リール", "使用前後の比較カルーセル"],
    hashtags: ["#アウトドアギア", "#キャンプ道具", "#週末キャンプ", "#キャンプ初心者", "#ソロキャンプ"],
    score: Math.min(100, Math.round(58 + metrics.engagementRate * 5 + metrics.saveRate * 8))
  };
}
