import { NextResponse, type NextRequest } from "next/server";
import { ROLE_COOKIE, TOKEN_COOKIE } from "@/lib/cookieNames";

type Role = "CUSTOMER" | "PROVIDER" | "ADMIN";

const homeFor = (role: Role) => (role === "ADMIN" ? "/admin/dashboard" : role === "PROVIDER" ? "/provider/home" : "/customer/home");

/** Pages signed-out people may open besides the entry screen. */
const publicPages = new Set(["/customer/forgot", "/provider/forgot"]);

/**
 * Former separate start, login and register pages. They all collapse into the
 * entry screen at "/", which signs everyone in and decides the side from the
 * account itself; sign-up links keep their intent through the query string.
 */
const legacyAuth = new Map<string, string>([
  ["/choose-role", "/"],
  ["/login", "/"],
  ["/register", "/?mode=signup"],
  ["/customer/start", "/"],
  ["/customer/login", "/"],
  ["/customer/register", "/?mode=signup"],
  ["/provider/start", "/"],
  ["/provider/login", "/"],
  ["/provider/register", "/?mode=signup&role=provider"],
  ["/admin/login", "/"],
]);

/**
 * Page gating only. The cookie cannot be verified here (Edge runtime, and the
 * token belongs to the API), so this checks presence and trusts the role cookie
 * to pick a landing page. Anything that matters verifies against the API in
 * requireUser().
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasToken = Boolean(request.cookies.get(TOKEN_COOKIE)?.value);
  const cookieRole = request.cookies.get(ROLE_COOKIE)?.value;
  const role: Role | null =
    hasToken && (cookieRole === "CUSTOMER" || cookieRole === "PROVIDER" || cookieRole === "ADMIN") ? cookieRole : null;

  const entry = pathname === "/" || legacyAuth.has(pathname);
  if (entry) {
    if (role) return NextResponse.redirect(new URL(homeFor(role), request.url));
    if (pathname === "/") return NextResponse.next();
    return NextResponse.redirect(new URL(legacyAuth.get(pathname)!, request.url));
  }

  if (publicPages.has(pathname)) {
    return role ? NextResponse.redirect(new URL(homeFor(role), request.url)) : NextResponse.next();
  }

  const area = pathname.startsWith("/admin") ? "ADMIN" : pathname.startsWith("/provider") ? "PROVIDER" : pathname.startsWith("/customer") ? "CUSTOMER" : null;
  if (area) {
    if (!role) return NextResponse.redirect(new URL("/", request.url));
    if (role !== area) return NextResponse.redirect(new URL(homeFor(role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|images|uploads|socket.io).*)"],
};
