import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/app-auth";
import { getAuthenticatedRole, getAuthenticatedUser } from "@/lib/authenticated-user";

export async function GET(request: NextRequest) {
  const clientId = process.env.INSTAGRAM_OAUTH_CLIENT_ID;
  const redirectUri = process.env.INSTAGRAM_OAUTH_REDIRECT_URI;
  if (!clientId || !redirectUri || !process.env.INSTAGRAM_OAUTH_CLIENT_SECRET || !process.env.APP_SESSION_SECRET) return NextResponse.json({ error: "Instagram認証の準備が完了していません。" }, { status: 503 });
  const state = await createSession(getAuthenticatedUser(request), getAuthenticatedRole(request));
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "instagram_business_basic,instagram_business_manage_insights");
  url.searchParams.set("force_reauth", "true");
  url.searchParams.set("state", state);
  return NextResponse.redirect(url);
}
