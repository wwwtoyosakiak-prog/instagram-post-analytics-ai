import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ sessionLoginEnabled: Boolean(process.env.APP_SESSION_SECRET) });
}
