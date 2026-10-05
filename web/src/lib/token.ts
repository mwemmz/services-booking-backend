/**
 * Session cookies for the Express API token.
 *
 * The token is the API's own JWT, stored httpOnly so client JS can never read
 * it. The API remains the only authority on identity: these helpers only store
 * and read credentials, they never decide who the user is.
 */
import { cookies } from "next/headers";
import { REFRESH_COOKIE, ROLE_COOKIE, TOKEN_COOKIE, type Session } from "@/lib/cookieNames";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 14,
} as const;

/** Role is not sensitive and must be readable by middleware for redirects. */
const roleCookieOptions = {
  httpOnly: false,
  sameSite: "lax",
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 14,
} as const;

export async function setSessionCookie(
  accessToken: string,
  refreshToken: string | undefined,
  role: Session["role"],
) {
  const jar = await cookies();
  jar.set(TOKEN_COOKIE, accessToken, cookieOptions);
  if (refreshToken) jar.set(REFRESH_COOKIE, refreshToken, cookieOptions);
  jar.set(ROLE_COOKIE, role, roleCookieOptions);
}

export async function clearSessionCookies() {
  const jar = await cookies();
  jar.set(TOKEN_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  jar.set(REFRESH_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  jar.set(ROLE_COOKIE, "", { ...roleCookieOptions, maxAge: 0 });
}

export async function readSessionTokens(): Promise<{
  token: string | null;
  refreshToken: string | null;
  role: Session["role"] | null;
}> {
  const jar = await cookies();
  const role = jar.get(ROLE_COOKIE)?.value;
  return {
    token: jar.get(TOKEN_COOKIE)?.value ?? null,
    refreshToken: jar.get(REFRESH_COOKIE)?.value ?? null,
    role: role === "PROVIDER" ? "PROVIDER" : role === "CUSTOMER" ? "CUSTOMER" : null,
  };
}