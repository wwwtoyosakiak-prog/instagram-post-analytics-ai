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

export function middleware(request: NextRequest) {
  if (publicPaths.has(request.nextUrl.pathname) || isCronRequest(request)) {
    return nextWithAuthenticatedUser(request);
  }

  const expectedUsername = process.env.APP_ACCESS_USER;
  const expectedPassword = process.env.APP_ACCESS_PASSWORD;

  if (!expectedUsername && !expectedPassword) {
    return nextWithAuthenticatedUser(request);
  }

  if (!expectedUsername || !expectedPassword) {
    return new NextResponse("Access protection is not configured correctly.", { status: 503 });
  }

  const credentials = readBasicCredentials(request);
  if (
    credentials
    && constantTimeEqual(credentials.username, expectedUsername)
    && constantTimeEqual(credentials.password, expectedPassword)
  ) {
    return nextWithAuthenticatedUser(request, expectedUsername);
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
