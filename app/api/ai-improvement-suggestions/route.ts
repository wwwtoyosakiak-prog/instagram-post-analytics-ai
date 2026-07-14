import { NextResponse } from "next/server";
import {
  buildAiImprovementSuggestionPrompt,
  normalizeAiImprovementSuggestions,
} from "@/lib/ai-improvement-suggestion";
import type { AiWeeklyReviewResult } from "@/lib/ai-weekly-review";
import {
  buildLearningContext,
  type AiLearningMemory,
} from "@/lib/ai-learning";

const openAiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

type Body = {
  weekStart?: string;
  weekEnd?: string;
  aiReview?: AiWeeklyReviewResult;
};

export async function POST(request: Request) {
  let body: Body;

  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { error: "JSON形式が正しくありません。" },
      { status: 400 },
    );
  }

  if (!body.weekStart || !body.weekEnd || !body.aiReview) {
    return NextResponse.json(
      { error: "週次レビュー情報が不足しています。" },
      { status: 400 },
    );
  }

  if (!openAiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEYを設定してください。" },
      { status: 500 },
    );
  }

  let learningContext =
    "過去の改善学習データはありません。";

  try {
    const baseUrl = new URL(request.url).origin;
    const learningResponse = await fetch(
      `${baseUrl}/api/ai-learning`,
      { cache: "no-store" },
    );

    if (learningResponse.ok) {
      const learningData =
        await learningResponse.json();
      learningContext = buildLearningContext(
        (learningData.memories ??
          []) as AiLearningMemory[],
      );
    }
  } catch {
    learningContext =
      "過去の改善学習データを取得できませんでした。";
  }

  const response = await fetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `${buildAiImprovementSuggestionPrompt(
                  body.weekStart,
                  body.weekEnd,
                  body.aiReview,
                )}

過去の改善学習データ:
${learningContext}

追加ルール:
- 過去に成功した類似施策は、その成功条件を考慮する。
- 過去に失敗した施策と同じ案を出す場合は、失敗原因を修正する。
- 過去データが少ない場合は、確実な学習済み知識のように扱わない。`,
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_object",
          },
        },
      }),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    return NextResponse.json(
      {
        error:
          data.error?.message ??
          "OpenAI APIの呼び出しに失敗しました。",
      },
      { status: response.status },
    );
  }

  const raw =
    data.output_text ??
    data.output
      ?.flatMap(
        (item: {
          content?: Array<{ text?: string }>;
        }) => item.content ?? [],
      )
      .map((item: { text?: string }) => item.text ?? "")
      .join("");

  try {
    const result = normalizeAiImprovementSuggestions(
      JSON.parse(raw || "{}"),
    );

    if (!result.suggestions.length) {
      throw new Error("改善案がありません。");
    }

    return NextResponse.json({
      result,
      model,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "AI回答の形式が正しくありません。再実行してください。",
      },
      { status: 502 },
    );
  }
}
