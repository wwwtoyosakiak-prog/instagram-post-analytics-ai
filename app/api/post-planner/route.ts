import { NextResponse } from "next/server";
import {
  buildPostPlannerPrompt,
  normalizePostPlannerResult,
  type PostPlannerInput,
} from "@/lib/post-planner";

const goals = [
  "reach",
  "engagement",
  "saves",
  "followers",
  "awareness",
] as const;

const postTypes = ["reel", "carousel", "image", "video"] as const;

export async function POST(request: Request) {
  let body: PostPlannerInput;

  try {
    body = (await request.json()) as PostPlannerInput;
  } catch {
    return NextResponse.json(
      { error: "JSON形式が正しくありません。" },
      { status: 400 },
    );
  }

  if (
    !goals.includes(body.goal) ||
    !postTypes.includes(body.postType) ||
    !body.theme?.trim() ||
    !body.audience?.trim() ||
    !body.keyMessage?.trim()
  ) {
    return NextResponse.json(
      {
        error:
          "目的、投稿形式、テーマ、対象者、伝えたい内容は必須です。",
      },
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
              text: buildPostPlannerPrompt(body),
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
    const result = normalizePostPlannerResult(
      JSON.parse(raw || "{}"),
    );

    if (!result.title || !result.caption) {
      throw new Error("必要な項目がありません。");
    }

    return NextResponse.json({ result, model });
  } catch (error) {
    console.error("[post-planner-parse]", error);

    return NextResponse.json(
      {
        error:
          "AI投稿企画の形式が不正でした。もう一度実行してください。",
      },
      { status: 502 },
    );
  }
}
