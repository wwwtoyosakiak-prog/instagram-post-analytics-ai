import { NextResponse } from "next/server";
import {
  isSupabaseConfigured,
  listPostsFromSupabase,
  listScoreHistoryFromSupabase,
} from "@/lib/supabase-admin";
import { buildAiChatContext, buildAiChatPrompt } from "@/lib/ai-chat";

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Server storage is not configured." },
      { status: 501 },
    );
  }

  const body = (await request.json()) as {
    question?: string;
    accountId?: string;
  };

  const question = body.question?.trim();

  if (!question) {
    return NextResponse.json(
      { error: "質問を入力してください。" },
      { status: 400 },
    );
  }

  if (question.length > 1000) {
    return NextResponse.json(
      { error: "質問は1000文字以内にしてください。" },
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

  const [posts, scoreHistory] = await Promise.all([
    listPostsFromSupabase(),
    listScoreHistoryFromSupabase(undefined, 5000),
  ]);

  const context = buildAiChatContext({
    posts,
    scoreHistory,
    accountId: body.accountId || undefined,
  });

  if (!context.length) {
    return NextResponse.json(
      { error: "分析できる投稿データがありません。" },
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
              text: buildAiChatPrompt(question, context),
            },
          ],
        },
      ],
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

  const answer =
    data.output_text ??
    data.output
      ?.flatMap(
        (item: { content?: { text?: string }[] }) =>
          item.content ?? [],
      )
      .map((item: { text?: string }) => item.text)
      .join("");

  if (!answer) {
    return NextResponse.json(
      { error: "AIの回答を取得できませんでした。" },
      { status: 502 },
    );
  }

  return NextResponse.json({ answer, model, postCount: context.length });
}
