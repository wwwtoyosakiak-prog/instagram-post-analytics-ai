import type { AiWeeklyReviewResult } from "@/lib/ai-weekly-review";

export type AiImprovementSuggestion = {
  rank: number;
  title: string;
  hypothesis: string;
  action: string;
  metricName: string;
  baselineValue: number | null;
  targetValue: number | null;
  reason: string;
  risk: string;
};

export type AiImprovementSuggestionResult = {
  sourceWeekStart: string;
  sourceWeekEnd: string;
  summary: string;
  suggestions: AiImprovementSuggestion[];
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : null;
}

export function normalizeAiImprovementSuggestions(
  value: unknown,
): AiImprovementSuggestionResult {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  const suggestions = Array.isArray(source.suggestions)
    ? source.suggestions
        .map((item, index) => {
          const row =
            item && typeof item === "object"
              ? (item as Record<string, unknown>)
              : {};

          return {
            rank:
              typeof row.rank === "number"
                ? Math.max(1, Math.min(3, Math.round(row.rank)))
                : index + 1,
            title: text(row.title),
            hypothesis: text(row.hypothesis),
            action: text(row.action),
            metricName: text(row.metricName),
            baselineValue: nullableNumber(row.baselineValue),
            targetValue: nullableNumber(row.targetValue),
            reason: text(row.reason),
            risk: text(row.risk),
          };
        })
        .filter(
          (item) =>
            item.title &&
            item.hypothesis &&
            item.action &&
            item.metricName,
        )
        .slice(0, 3)
    : [];

  return {
    sourceWeekStart: text(source.sourceWeekStart),
    sourceWeekEnd: text(source.sourceWeekEnd),
    summary: text(source.summary),
    suggestions,
  };
}

export function buildAiImprovementSuggestionPrompt(
  weekStart: string,
  weekEnd: string,
  aiReview: AiWeeklyReviewResult,
) {
  return `あなたはInstagram運用改善の実験設計担当です。
以下のAI週次レビューから、1週間で検証できる改善案を3件提案してください。

ルール:
- 入力にない数値を事実として断定しない。
- 主要な変更要素は各案につき1つに絞る。
- KPIは1つに絞る。
- baselineValueとtargetValueは根拠がない場合nullにする。
- 施策は7日以内で実行可能にする。
- rankは1〜3で重複させない。
- JSONだけを出力する。

対象週: ${weekStart}〜${weekEnd}

AI週次レビュー:
${JSON.stringify(aiReview, null, 2)}

出力形式:
{
  "sourceWeekStart": "${weekStart}",
  "sourceWeekEnd": "${weekEnd}",
  "summary": "提案全体の要約",
  "suggestions": [
    {
      "rank": 1,
      "title": "改善テーマ",
      "hypothesis": "改善仮説",
      "action": "具体的な施策",
      "metricName": "成功判定KPI",
      "baselineValue": null,
      "targetValue": null,
      "reason": "この案を優先する理由",
      "risk": "注意点"
    }
  ]
}`;
}
