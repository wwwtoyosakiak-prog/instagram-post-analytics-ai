import { NextResponse } from "next/server";
import type { GrowthStrategyResult } from "@/lib/growth-strategy";
import {
  buildGrowthAdvisorPrompt,
  normalizeGrowthAdvisorResult,
} from "@/lib/growth-advisor";

export async function POST(request: Request) {
  let body: { strategy?: GrowthStrategyResult };

  try {
    body = (await request.json()) as {
      strategy?: GrowthStrategyResult;
    };
  } catch {
    return NextResponse.json(
      { error: "JSON形式が正しくありません。" },
      { status: 400 },
    );
  }

  if (!body.strategy) {
    return NextResponse.json(
      { error: "成長戦略データが必要です。" },
      { status: 400 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEYを設定してください。" },
      { status: 500 },
    );
  }

  const response = await fetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: buildGrowthAdvisorPrompt(
                  body.strategy,
                ),
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
    const advisor = normalizeGrowthAdvisorResult(
      JSON.parse(raw || "{}"),
    );

    if (
      !advisor.executiveSummary ||
      !advisor.topPriority.title
    ) {
      throw new Error("必要な項目が不足しています。");
    }

    return NextResponse.json({
      advisor,
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
