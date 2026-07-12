import { NextResponse } from "next/server";
import { buildAiManager } from "@/lib/ai-manager";

type Body = {
  today?: string;
  schedules?: unknown[];
  notifications?: unknown[];
  pipelineCards?: unknown[];
  growthStrategy?: unknown;
  weekTarget?: number;
};

export async function POST(request: Request) {
  let body: Body;

  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { error: "JSON形式が正しくありません。" },
      { status: 400 },
    );
  }

  const today =
    typeof body.today === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(body.today)
      ? body.today
      : new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Tokyo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());

  try {
    const manager = buildAiManager({
      today,
      schedules: Array.isArray(body.schedules)
        ? (body.schedules as never[])
        : [],
      notifications: Array.isArray(body.notifications)
        ? (body.notifications as never[])
        : [],
      pipelineCards: Array.isArray(body.pipelineCards)
        ? (body.pipelineCards as never[])
        : [],
      growthStrategy:
        body.growthStrategy &&
        typeof body.growthStrategy === "object"
          ? (body.growthStrategy as never)
          : null,
      weekTarget:
        typeof body.weekTarget === "number"
          ? body.weekTarget
          : 3,
    });

    return NextResponse.json({ manager });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "運用マネージャーを作成できませんでした。",
      },
      { status: 500 },
    );
  }
}
