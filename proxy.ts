import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "./lib/auth/cookies";

const PUBLIC_PAGES = ["/login", "/signup"];

// Only checks that a login cookie exists, to redirect visitors to the login page.
// The real session check happens in the pages and API routes themselves.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!request.cookies.has(SESSION_COOKIE) && !PUBLIC_PAGES.includes(pathname)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // API routes return their own 401 JSON, so they are excluded here
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};