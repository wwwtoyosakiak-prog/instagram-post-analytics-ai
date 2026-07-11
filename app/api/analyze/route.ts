import { NextResponse } from "next/server";
import { InstagramAccount, InstagramPost } from "@/lib/types";
import { normalizeAiAnalysis } from "@/lib/ai-analysis";
import { buildAiAnalysisPrompt } from "@/lib/ai-analysis-prompt";

export async function POST(request: Request) {
  const { post, account } = (await request.json()) as { post?: InstagramPost; account?: InstagramAccount | null };
  if (!post) return NextResponse.json({ error: "投稿データがありません。" }, { status: 400 });

  const apiKeyEnvName = account?.openaiApiKeyEnvName?.trim();
  const apiKey = apiKeyEnvName ? process.env[apiKeyEnvName] : process.env.OPENAI_API_KEY;
  const model = account?.openaiModel?.trim() || process.env.OPENAI_MODEL || "gpt-4.1-mini";
  if (!apiKey) {
    return NextResponse.json({
      error: apiKeyEnvName
        ? `.env.local またはVercelに ${apiKeyEnvName} を設定してください。`
        : ".env.local に OPENAI_API_KEY を設定してください。APIキーなしの場合はサンプル分析を使えます。"
    }, { status: 400 });
  }

  const prompt = buildAiAnalysisPrompt(post, account);

  const content: Array<Record<string, unknown>> = [{ type: "input_text", text: prompt }];
  if (post.screenshot) {
    content.push({ type: "input_image", image_url: post.screenshot });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: [{ role: "user", content }],
      text: { format: { type: "json_object" } }
    })
  });

  const data = await response.json();
  if (!response.ok) {
    return NextResponse.json({ error: data.error?.message ?? "OpenAI APIの呼び出しに失敗しました。" }, { status: response.status });
  }

  const raw = data.output_text ?? data.output?.flatMap((item: { content?: { text?: string }[] }) => item.content ?? []).map((item: { text?: string }) => item.text).join("");
  try {
    const analysis = normalizeAiAnalysis(JSON.parse(raw));
    return NextResponse.json({ analysis, model, apiKeyEnvName: apiKeyEnvName || "OPENAI_API_KEY" });
  } catch (error) {
    console.error("[analyze-response-parse]", error);
    return NextResponse.json({ error: "AI分析結果の形式が不正でした。もう一度分析してください。" }, { status: 502 });
  }
}
