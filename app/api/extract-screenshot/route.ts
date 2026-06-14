import { NextResponse } from "next/server";
import { PostType } from "@/lib/types";

type ExtractedPostFields = {
  date?: string;
  url?: string;
  caption?: string;
  hashtags?: string;
  type?: PostType;
  mediaCount?: number;
  likes?: number;
  comments?: number;
  saves?: number;
  shares?: number;
  views?: number;
  memo?: string;
};

export async function POST(request: Request) {
  const { image } = (await request.json()) as { image?: string };
  if (!image) return NextResponse.json({ error: "スクショ画像がありません。" }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: ".env.local に OPENAI_API_KEY を設定すると、スクショ自動入力を使えます。" }, { status: 400 });
  }

  const prompt = `Instagram投稿のスクリーンショットから、投稿登録フォームに入れられる情報を読み取ってください。

重要:
- Instagram APIや外部取得は使わず、この画像に見えている情報だけを抽出します。
- 見えない項目や自信がない項目は省略してください。
- 投稿本文とハッシュタグは分けてください。captionにはハッシュタグを含めず、hashtagsに # 付きでまとめてください。
- 数値は 1.2万, 3,456, 12K のような表記を整数に変換してください。
- 投稿日は推定せず、画像内に日付が明確にある場合だけ YYYY-MM-DD で返してください。
- 投稿タイプは画像から判断できる場合のみ image / video / reel / carousel のいずれかで返してください。
- 投稿内の画像や動画が何枚あるか判断できる場合は mediaCount に整数で返してください。
- JSONだけを返してください。

返却形式:
{
  "date": "YYYY-MM-DD",
  "url": "string",
  "caption": "string",
  "hashtags": "string",
  "type": "image",
  "mediaCount": 1,
  "likes": 0,
  "comments": 0,
  "saves": 0,
  "shares": 0,
  "views": 0,
  "memo": "string"
}`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: image }
          ]
        }
      ],
      text: { format: { type: "json_object" } }
    })
  });

  const data = await response.json();
  if (!response.ok) {
    return NextResponse.json({ error: data.error?.message ?? "スクショ解析に失敗しました。" }, { status: response.status });
  }

  const raw = data.output_text ?? data.output?.flatMap((item: { content?: { text?: string }[] }) => item.content ?? []).map((item: { text?: string }) => item.text).join("");
  const extracted = normalizeExtractedFields(JSON.parse(raw || "{}"));
  return NextResponse.json({ extracted });
}

function normalizeExtractedFields(fields: ExtractedPostFields): ExtractedPostFields {
  const numericKeys: Array<keyof Pick<ExtractedPostFields, "mediaCount" | "likes" | "comments" | "saves" | "shares" | "views">> = ["mediaCount", "likes", "comments", "saves", "shares", "views"];
  const normalized: ExtractedPostFields = { ...fields };

  if (normalized.type !== "image" && normalized.type !== "video" && normalized.type !== "reel" && normalized.type !== "carousel") {
    delete normalized.type;
  }

  for (const key of numericKeys) {
    const value = normalized[key];
    if (typeof value !== "number" || Number.isNaN(value) || value < (key === "mediaCount" ? 1 : 0)) {
      delete normalized[key];
    } else {
      normalized[key] = Math.round(value);
    }
  }

  return normalized;
}
