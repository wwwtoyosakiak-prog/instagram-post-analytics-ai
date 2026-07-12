import { NextResponse } from "next/server";
import { generateOperationNotifications } from "@/lib/notification-generation";

export async function POST() {
  try {
    const result =
      await generateOperationNotifications("manual");

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "通知を生成できませんでした。",
      },
      { status: 500 },
    );
  }
}
