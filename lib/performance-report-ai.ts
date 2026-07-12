import type {
  PerformanceReport,
  PerformanceReportAiSummary,
} from "@/lib/types";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function textArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(text).filter(Boolean).slice(0, 10)
    : [];
}

export function normalizePerformanceReportAiSummary(
  value: unknown,
): PerformanceReportAiSummary {
  const item =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  return {
    overallSummary: text(item.overallSummary),
    strengths: textArray(item.strengths),
    weaknesses: textArray(item.weaknesses),
    nextActions: textArray(item.nextActions),
    contentIdeas: textArray(item.contentIdeas),
    recommendedCtas: textArray(item.recommendedCtas),
    risks: textArray(item.risks),
    evidence: textArray(item.evidence),
  };
}

export function buildPerformanceReportAiPrompt(report: PerformanceReport) {
  return `あなたはInstagram運用のデータアナリスト兼コンテンツ戦略担当です。
以下の集計レポートだけを根拠に、日本語で実行可能な次期戦略を作成してください。

# 重要ルール
- 入力に存在しないフォロワー属性、競合平均、最適投稿時間を創作しない。
- 前期間比較がnullの場合は、比較不能であることを明示する。
- 投稿数が少ない場合は、断定せず暫定評価と書く。
- 強み・弱み・戦略には、できる限り具体的な入力数値を含める。
- 「改善する」「工夫する」だけで終わらず、次回投稿で実行できる行動にする。
- 出力はJSONオブジェクトのみ。Markdownや前置きは禁止。

# 対象期間
${report.period.from} 〜 ${report.period.to}

# 集計値
${JSON.stringify(
  {
    totals: report.totals,
    averages: report.averages,
    scoreBreakdown: report.scoreBreakdown,
    comparison: report.comparison,
    bestPost: report.bestPost
      ? {
          id: report.bestPost.id,
          date: report.bestPost.date,
          type: report.bestPost.type,
          views: report.bestPost.views,
          likes: report.bestPost.likes,
          comments: report.bestPost.comments,
          saves: report.bestPost.saves,
          shares: report.bestPost.shares,
          caption: report.bestPost.caption,
        }
      : null,
    needsWorkPost: report.needsWorkPost
      ? {
          id: report.needsWorkPost.id,
          date: report.needsWorkPost.date,
          type: report.needsWorkPost.type,
          views: report.needsWorkPost.views,
          likes: report.needsWorkPost.likes,
          comments: report.needsWorkPost.comments,
          saves: report.needsWorkPost.saves,
          shares: report.needsWorkPost.shares,
          caption: report.needsWorkPost.caption,
        }
      : null,
  },
  null,
  2,
)}

# 出力形式
{
  "overallSummary": "期間全体の総評。数値根拠を含む3〜5文",
  "strengths": ["具体的な強みを2〜4件"],
  "weaknesses": ["具体的な改善点を2〜4件"],
  "nextActions": ["次期に優先して実行する行動を3〜5件"],
  "contentIdeas": ["次期投稿テーマ案を3〜5件"],
  "recommendedCtas": ["投稿に使えるCTA候補を3件"],
  "risks": ["データ不足や運用上の注意点を1〜3件"],
  "evidence": ["判断の根拠となった数値を3〜6件"]
}`;
}
