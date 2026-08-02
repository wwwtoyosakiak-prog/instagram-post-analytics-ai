import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedRole, getAuthenticatedUser } from "@/lib/authenticated-user";

export async function GET(request: NextRequest) {
  return NextResponse.json({ sessionLoginEnabled: Boolean(process.env.APP_SESSION_SECRET), userId: getAuthenticatedUser(request), role: getAuthenticatedRole(request) });
}
