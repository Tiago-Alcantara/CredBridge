import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_LANDING_HOSTNAMES = new Set([
  "www.lane-credbridge.app",
  "cred-bridge.vercel.app",
]);
const PUBLIC_LANDING_HEADER = "x-credbridge-public-landing";

function isStaticAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname === "/icon.svg" ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    /\.[^/]+$/.test(pathname)
  );
}

export function proxy(request: NextRequest) {
  if (!PUBLIC_LANDING_HOSTNAMES.has(request.nextUrl.hostname)) {
    return NextResponse.next();
  }

  if (isStaticAssetPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname !== "/") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(PUBLIC_LANDING_HEADER, "true");

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
