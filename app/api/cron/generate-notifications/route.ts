import { NextRequest, NextResponse } from "next/server";
import { generateOperationNotifications } from "@/lib/notification-generation";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  return (
    request.headers.get("authorization") === `Bearer ${secret}`
  );
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const result = await generateOperationNotifications("cron");

    return NextResponse.json({
      ...result,
      executedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "通知生成に失敗しました。",
      },
      { status: 500 },
    );
  }
}
