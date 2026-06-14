import { NextResponse } from "next/server";

export async function POST() {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        message: ".env.local に OPENAI_API_KEY が設定されていません。",
        model
      },
      { status: 400 }
    );
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: "API connection test. Reply with exactly: OK"
    })
  });

  const data = await response.json();
  if (!response.ok) {
    return NextResponse.json(
      {
        ok: false,
        message: data.error?.message ?? "OpenAI APIへの接続に失敗しました。",
        model
      },
      { status: response.status }
    );
  }

  const output = data.output_text ?? data.output?.flatMap((item: { content?: { text?: string }[] }) => item.content ?? []).map((item: { text?: string }) => item.text).join("");

  return NextResponse.json({
    ok: true,
    message: "OpenAI API連携は正常です。",
    model,
    output
  });
}
