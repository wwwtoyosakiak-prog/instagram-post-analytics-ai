import { NextRequest, NextResponse } from "next/server";
import { authenticateAppUser, readAppUsers, readSession, SESSION_COOKIE } from "@/lib/app-auth";
import { hasInstagramConnection } from "@/lib/instagram-user-config";

const publicPaths = new Set(["/api/health", "/login", "/api/auth/login"]);
const cronProtectedPaths = [
  "/api/cron/",
  "/api/instagram/full-sync",
  "/api/instagram/sync",
];
const authenticatedUserHeader = "x-app-authenticated-user";

function nextWithAuthenticatedUser(request: NextRequest, username?: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(authenticatedUserHeader);
  if (username) requestHeaders.set(authenticatedUserHeader, username);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

function isCronRequest(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const usesCronAuthentication = cronProtectedPaths.some((path) =>
    path.endsWith("/") ? pathname.startsWith(path) : pathname === path,
  );
  return usesCronAuthentication && request.headers.get("authorization")?.startsWith("Bearer ");
}

function readBasicCredentials(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) return null;

  try {
    const decoded = atob(authorization.slice(6));
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  if (publicPaths.has(request.nextUrl.pathname) || isCronRequest(request)) {
    return nextWithAuthenticatedUser(request);
  }

  const configuredUsers = readAppUsers();
  if (configuredUsers?.length === 0) {
    return nextWithAuthenticatedUser(request);
  }

  if (!configuredUsers) {
    return new NextResponse("Access protection is not configured correctly.", { status: 503 });
  }

  const credentials = readBasicCredentials(request);
  const basicAuthentication = credentials ? authenticateAppUser(credentials.username, credentials.password) : null;
  const sessionOwner = await readSession(request.cookies.get(SESSION_COOKIE)?.value);
  const ownerId = basicAuthentication?.status === "authenticated" ? basicAuthentication.ownerId : sessionOwner;
  if (ownerId) {
    if (!hasInstagramConnection(ownerId) && request.nextUrl.pathname.startsWith("/api/instagram/")) {
      return NextResponse.json({ error: "このユーザーのInstagram連携はまだ設定されていません。" }, { status: 403 });
    }
    return nextWithAuthenticatedUser(request, ownerId);
  }

  if (process.env.APP_SESSION_SECRET) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "Cache-Control": "no-store",
      "WWW-Authenticate": 'Basic realm="Instagram Analytics", charset="UTF-8"',
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
