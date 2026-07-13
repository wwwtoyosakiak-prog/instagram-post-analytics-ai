import { NextResponse } from "next/server";
import type { WeeklyOperationReview } from "@/lib/weekly-operation-review";
import {
  buildAiWeeklyReviewPrompt,
  normalizeAiWeeklyReview,
} from "@/lib/ai-weekly-review";

export async function POST(request: Request) {
  let body: { review?: WeeklyOperationReview };

  try {
    body = (await request.json()) as {
      review?: WeeklyOperationReview;
    };
  } catch {
    return NextResponse.json(
      { error: "JSON形式が正しくありません。" },
      { status: 400 },
    );
  }

  if (!body.review) {
    return NextResponse.json(
      { error: "週間レビューが必要です。" },
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
                text: buildAiWeeklyReviewPrompt(
                  body.review,
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
    const aiReview = normalizeAiWeeklyReview(
      JSON.parse(raw || "{}"),
    );

    if (
      !aiReview.executiveSummary ||
      !aiReview.nextWeekPriority.title
    ) {
      throw new Error("必要な項目が不足しています。");
    }

    return NextResponse.json({
      aiReview,
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
