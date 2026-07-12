import { NextResponse } from "next/server";
import type {
  InstagramAccount,
  PerformanceReport,
} from "@/lib/types";
import {
  buildPerformanceReportAiPrompt,
  normalizePerformanceReportAiSummary,
} from "@/lib/performance-report-ai";

export async function POST(request: Request) {
  const { report, account } = (await request.json()) as {
    report?: PerformanceReport;
    account?: InstagramAccount | null;
  };

  if (!report) {
    return NextResponse.json(
      { error: "集計レポートがありません。" },
      { status: 400 },
    );
  }

  const apiKeyEnvName = account?.openaiApiKeyEnvName?.trim();
  const apiKey = apiKeyEnvName
    ? process.env[apiKeyEnvName]
    : process.env.OPENAI_API_KEY;
  const model =
    account?.openaiModel?.trim() ||
    process.env.OPENAI_MODEL ||
    "gpt-4.1-mini";

  if (!apiKey) {
    return NextResponse.json(
      {
        error: apiKeyEnvName
          ? `Vercelに ${apiKeyEnvName} を設定してください。`
          : "VercelにOPENAI_API_KEYを設定してください。",
      },
      { status: 400 },
    );
  }

  const prompt = buildPerformanceReportAiPrompt(report);
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
          content: [{ type: "input_text", text: prompt }],
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
        (item: { content?: { text?: string }[] }) =>
          item.content ?? [],
      )
      .map((item: { text?: string }) => item.text)
      .join("");

  try {
    const summary = normalizePerformanceReportAiSummary(
      JSON.parse(raw),
    );

    return NextResponse.json({
      summary,
      model,
      apiKeyEnvName: apiKeyEnvName || "OPENAI_API_KEY",
    });
  } catch (error) {
    console.error("[performance-report-ai-parse]", error);
    return NextResponse.json(
      {
        error:
          "AIレポートの形式が不正でした。もう一度生成してください。",
      },
      { status: 502 },
    );
  }
}
