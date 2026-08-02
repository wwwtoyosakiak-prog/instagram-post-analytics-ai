import { NextRequest, NextResponse } from "next/server";
import { readSessionDetails } from "@/lib/app-auth";
import { saveStoredInstagramConnection } from "@/lib/instagram-connection-store";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = await readSessionDetails(request.nextUrl.searchParams.get("state"));
  const redirectUri = process.env.INSTAGRAM_OAUTH_REDIRECT_URI;
  if (!code || !state || !redirectUri || !process.env.INSTAGRAM_OAUTH_CLIENT_ID || !process.env.INSTAGRAM_OAUTH_CLIENT_SECRET) return NextResponse.redirect(new URL("/token-management?connection=failed", request.url));
  try {
    const form = new URLSearchParams({ client_id: process.env.INSTAGRAM_OAUTH_CLIENT_ID, client_secret: process.env.INSTAGRAM_OAUTH_CLIENT_SECRET, grant_type: "authorization_code", redirect_uri: redirectUri, code });
    const shortResponse = await fetch("https://api.instagram.com/oauth/access_token", { method: "POST", body: form, cache: "no-store" });
    if (!shortResponse.ok) throw new Error("token exchange failed");
    const short = await shortResponse.json() as { access_token: string; user_id?: string };
    const longUrl = new URL("https://graph.instagram.com/access_token");
    longUrl.searchParams.set("grant_type", "ig_exchange_token");
    longUrl.searchParams.set("client_secret", process.env.INSTAGRAM_OAUTH_CLIENT_SECRET);
    longUrl.searchParams.set("access_token", short.access_token);
    const longResponse = await fetch(longUrl, { cache: "no-store" });
    const token = longResponse.ok ? await longResponse.json() as { access_token: string; expires_in?: number } : short;
    await saveStoredInstagramConnection(state.ownerId, { access_token: token.access_token, instagram_user_id: short.user_id ?? null, username: null, expires_at: "expires_in" in token && token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null });
    return NextResponse.redirect(new URL("/token-management?connection=success", request.url));
  } catch {
    return NextResponse.redirect(new URL("/token-management?connection=failed", request.url));
  }
}
