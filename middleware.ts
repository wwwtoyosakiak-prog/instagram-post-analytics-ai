import { NextRequest, NextResponse } from "next/server";

const publicPaths = new Set(["/api/health"]);
const cronProtectedPaths = [
  "/api/cron/",
  "/api/instagram/full-sync",
  "/api/instagram/sync",
];
const authenticatedUserHeader = "x-app-authenticated-user";

function constantTimeEqual(actual: string, expected: string) {
  const length = Math.max(actual.length, expected.length);
  let difference = actual.length ^ expected.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (actual.charCodeAt(index) || 0) ^ (expected.charCodeAt(index) || 0);
  }

  return difference === 0;
}

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

function readConfiguredUsers() {
  const configuredUsers = process.env.APP_ACCESS_USERS;
  if (configuredUsers) {
    if (
      process.env.USER_DATA_OWNERSHIP_ENABLED !== "true"
      || !process.env.SUPABASE_URL
      || !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) return null;
    try {
      const parsed = JSON.parse(configuredUsers) as unknown;
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") return null;
      const users = Object.entries(parsed)
        .filter((entry): entry is [string, string] => Boolean(entry[0]) && typeof entry[1] === "string" && Boolean(entry[1]))
        .map(([username, password]) => ({ username, password, ownerId: username }));
      return users.length > 0 ? users : null;
    } catch {
      return null;
    }
  }

  const username = process.env.APP_ACCESS_USER;
  const password = process.env.APP_ACCESS_PASSWORD;
  if (!username && !password) return [];
  if (!username || !password) return null;
  return [{ username, password, ownerId: "owner" }];
}

export function middleware(request: NextRequest) {
  if (publicPaths.has(request.nextUrl.pathname) || isCronRequest(request)) {
    return nextWithAuthenticatedUser(request);
  }

  const configuredUsers = readConfiguredUsers();
  if (configuredUsers?.length === 0) {
    return nextWithAuthenticatedUser(request);
  }

  if (!configuredUsers) {
    return new NextResponse("Access protection is not configured correctly.", { status: 503 });
  }

  const credentials = readBasicCredentials(request);
  const matchedUser = credentials
    ? configuredUsers.find(({ username, password }) =>
      constantTimeEqual(credentials.username, username) && constantTimeEqual(credentials.password, password))
    : null;
  if (matchedUser) {
    if (matchedUser.ownerId !== "owner" && request.nextUrl.pathname.startsWith("/api/instagram/")) {
      return NextResponse.json(
        { error: "このユーザーのInstagram連携はまだ設定されていません。" },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }
    return nextWithAuthenticatedUser(request, matchedUser.ownerId);
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
