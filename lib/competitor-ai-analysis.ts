export type CompetitorBenchmarkInput = {
  own: {
    posts: number;
    averageViews: number;
    engagementRate: number;
    topPostType: string | null;
  };
  competitor: {
    name: string;
    username: string;
    posts: number;
    averageViews: number;
    engagementRate: number;
    topPostType: string | null;
    topHashtags: string[];
  };
};

export type CompetitorAiAnalysis = {
  overallSummary: string;
  winningPoints: string[];
  losingPoints: string[];
  immediateActions: string[];
  sevenDayPlan: string[];
  contentIdeas: string[];
  benchmarkLessons: string[];
  cautions: string[];
  evidence: string[];
};

function toText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toTextArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(toText).filter(Boolean).slice(0, 10)
    : [];
}

export function normalizeCompetitorAiAnalysis(
  value: unknown,
): CompetitorAiAnalysis {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  return {
    overallSummary: toText(source.overallSummary),
    winningPoints: toTextArray(source.winningPoints),
    losingPoints: toTextArray(source.losingPoints),
    immediateActions: toTextArray(source.immediateActions),
    sevenDayPlan: toTextArray(source.sevenDayPlan),
    contentIdeas: toTextArray(source.contentIdeas),
    benchmarkLessons: toTextArray(source.benchmarkLessons),
    cautions: toTextArray(source.cautions),
    evidence: toTextArray(source.evidence),
  };
}

export function buildCompetitorAiPrompt(input: CompetitorBenchmarkInput) {
  return `あなたはInstagram運用の競合分析担当です。
以下の集計値だけを根拠に、日本語で比較分析してください。

ルール:
- 入力にないフォロワー属性、保存数、投稿時刻などを創作しない。
- 投稿数が3件未満なら暫定評価と明記する。
- 平均表示数はアカウント規模の影響を受ける可能性があるため断定しすぎない。
- 競合を丸ごと模倣せず、自アカウントらしく応用する案を出す。
- 出力はJSONのみ。

比較データ:
${JSON.stringify(input, null, 2)}

出力形式:
{
  "overallSummary": "全体総評",
  "winningPoints": ["優位点"],
  "losingPoints": ["改善点"],
  "immediateActions": ["次の投稿から実行すること"],
  "sevenDayPlan": ["7日間の計画"],
  "contentIdeas": ["投稿テーマ案"],
  "benchmarkLessons": ["競合から学べること"],
  "cautions": ["比較上の注意点"],
  "evidence": ["数値根拠"]
}`;
}
