import { NextResponse } from "next/server";
import {
  buildCompetitorAiPrompt,
  normalizeCompetitorAiAnalysis,
  type CompetitorBenchmarkInput,
} from "@/lib/competitor-ai-analysis";

export async function POST(request: Request) {
  let body: CompetitorBenchmarkInput;

  try {
    body = (await request.json()) as CompetitorBenchmarkInput;
  } catch {
    return NextResponse.json(
      { error: "JSON形式が正しくありません。" },
      { status: 400 },
    );
  }

  if (!body?.own || !body?.competitor) {
    return NextResponse.json(
      { error: "比較データが不足しています。" },
      { status: 400 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  if (!apiKey) {
    return NextResponse.json(
      { error: "VercelにOPENAI_API_KEYを設定してください。" },
      { status: 400 },
    );
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
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
              text: buildCompetitorAiPrompt(body),
            },
          ],
        },
      ],
      text: { format: { type: "json_object" } },
    }),
  });

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
        (item: { content?: Array<{ text?: string }> }) =>
          item.content ?? [],
      )
      .map((item: { text?: string }) => item.text ?? "")
      .join("");

  try {
    const analysis = normalizeCompetitorAiAnalysis(
      JSON.parse(raw || "{}"),
    );

    if (!analysis.overallSummary) {
      throw new Error("総評がありません。");
    }

    return NextResponse.json({ analysis, model });
  } catch (error) {
    console.error("[competitor-ai-analysis-parse]", error);
    return NextResponse.json(
      { error: "AI回答の形式が不正でした。もう一度実行してください。" },
      { status: 502 },
    );
  }
}
