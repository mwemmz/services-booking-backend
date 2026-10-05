import { NextResponse, type NextRequest } from "next/server";
import { ROLE_COOKIE, TOKEN_COOKIE } from "@/lib/cookieNames";

const customerPublic = new Set(["/customer/start", "/customer/login", "/customer/register", "/customer/forgot"]);
const providerPublic = new Set(["/provider/start", "/provider/login", "/provider/register", "/provider/forgot"]);

/**
 * Page gating only. The cookie cannot be verified here (Edge runtime, and the
 * token belongs to the API), so this checks presence and trusts the role cookie
 * to pick a landing page. Anything that matters verifies against the API in
 * requireUser().
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasToken = Boolean(request.cookies.get(TOKEN_COOKIE)?.value);
  const role = request.cookies.get(ROLE_COOKIE)?.value;
  const signedIn = hasToken && (role === "CUSTOMER" || role === "PROVIDER");
  const session = signedIn ? { role } : null;

  if (pathname === "/" || pathname === "/choose-role") {
    if (!session) return NextResponse.next();
    return NextResponse.redirect(new URL(session.role === "PROVIDER" ? "/provider/home" : "/customer/home", request.url));
  }

  if (pathname.startsWith("/customer")) {
    if (customerPublic.has(pathname)) {
      if (session?.role === "CUSTOMER") return NextResponse.redirect(new URL("/customer/home", request.url));
      if (session?.role === "PROVIDER") return NextResponse.redirect(new URL("/provider/home", request.url));
      return NextResponse.next();
    }
    if (session?.role !== "CUSTOMER") {
      return NextResponse.redirect(new URL("/customer/login", request.url));
    }
  }

  if (pathname.startsWith("/provider")) {
    if (providerPublic.has(pathname)) {
      if (session?.role === "PROVIDER") return NextResponse.redirect(new URL("/provider/home", request.url));
      if (session?.role === "CUSTOMER") return NextResponse.redirect(new URL("/customer/home", request.url));
      return NextResponse.next();
    }
    if (session?.role !== "PROVIDER") {
      return NextResponse.redirect(new URL("/provider/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|images|uploads|socket.io).*)"],
};