/**
 * Cookie names shared by the session helpers and the Edge middleware.
 *
 * Kept free of any `next/headers` import so middleware can read it: middleware
 * runs on the Edge runtime and cannot use the Node-only cookies() API.
 */

export const TOKEN_COOKIE = "zam_token";
export const REFRESH_COOKIE = "zam_refresh";
export const ROLE_COOKIE = "zam_role";

export type Session = { userId: string; role: "CUSTOMER" | "PROVIDER" };

export const isUiRole = (value: string | undefined | null): value is Session["role"] =>
  value === "CUSTOMER" || value === "PROVIDER";