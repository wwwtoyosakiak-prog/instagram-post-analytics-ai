import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/instagram-token-manager";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

type CronStepResult = {
  ok: boolean;
  status: number;
  body: unknown;
};

async function callInternalSync(request: Request, path: string) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return {
      ok: false,
      status: 500,
      body: { error: "CRON_SECRETが設定されていません。" }
    } satisfies CronStepResult;
  }

  const response = await fetch(new URL(path, request.url), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secret}`
    },
    cache: "no-store"
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = { error: "レスポンスを読み取れませんでした。" };
  }

  return {
    ok: response.ok,
    status: response.status,
    body
  } satisfies CronStepResult;
}

export async function GET(request: Request) {
  const auth = isCronAuthorized(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const [fullSyncResult, snapshotSyncResult] = await Promise.all([
    callInternalSync(request, "/api/instagram/full-sync"),
    callInternalSync(request, "/api/instagram/sync")
  ]);

  const ok = fullSyncResult.ok && snapshotSyncResult.ok;
  const status = ok ? 200 : 500;

  return NextResponse.json(
    {
      ok,
      fullSync: fullSyncResult,
      snapshotSync: snapshotSyncResult
    },
    { status }
  );
}
