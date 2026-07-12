import { NextRequest, NextResponse } from "next/server";
import {
  isSupabaseConfigured,
  listPostsFromSupabase,
  listScoreHistoryFromSupabase,
} from "@/lib/supabase-admin";
import {
  buildOperationConsultantContext,
  buildOperationConsultantPrompt,
  normalizeOperationConsultantResult,
} from "@/lib/operation-consultant";

function validDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Server storage is not configured." },
      { status: 501 },
    );
  }

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const accountId =
    request.nextUrl.searchParams.get("accountId") || undefined;

  if (!validDate(from) || !validDate(to)) {
    return NextResponse.json(
      { error: "fromとtoをYYYY-MM-DD形式で指定してください。" },
      { status: 400 },
    );
  }

  if (from > to) {
    return NextResponse.json(
      { error: "fromはto以前の日付にしてください。" },
      { status: 400 },
    );
  }

  const [posts, scoreHistory] = await Promise.all([
    listPostsFromSupabase(),
    listScoreHistoryFromSupabase(undefined, 5000),
  ]);

  const context = buildOperationConsultantContext(
    posts,
    scoreHistory,
    from,
    to,
    accountId,
  );

  return NextResponse.json({ context });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    context?: unknown;
  };

  if (!body.context) {
    return NextResponse.json(
      { error: "分析データがありません。" },
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
              text: buildOperationConsultantPrompt(
                body.context as Parameters<
                  typeof buildOperationConsultantPrompt
                >[0],
              ),
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
    const result = normalizeOperationConsultantResult(
      JSON.parse(raw || "{}"),
    );

    if (!result.weeklySummary) {
      throw new Error("AI回答に総評がありません。");
    }

    return NextResponse.json({ result, model });
  } catch (error) {
    console.error("[operation-consultant-parse]", error);
    return NextResponse.json(
      { error: "AI運用計画の形式が不正でした。もう一度実行してください。" },
      { status: 502 },
    );
  }
}
