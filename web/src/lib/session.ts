import { cookies } from "next/headers";
import { TOKEN_COOKIE, REFRESH_COOKIE, ROLE_COOKIE } from "@/lib/cookieNames";
import { apiFetch, ApiError, toUiRole, type UiRole } from "@/lib/api";
import { HttpError } from "@/lib/http";

/**
 * The session is the Express API's own token pair, kept in httpOnly cookies.
 * There is no second JWT and no local user table: whoever the token belongs to
 * is whoever the API says it is.
 *
 * Roles stay uppercase here because that is what every screen branches on, and
 * the API speaks lowercase.
 */
export type Role = UiRole;
export type Session = { role: Role; token: string };

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
};

export async function setSession(
  tokens: { accessToken: string; refreshToken?: string },
  user: { role?: string },
) {
  const jar = await cookies();
  const role = toUiRole(user.role);

  jar.set(TOKEN_COOKIE, tokens.accessToken, { ...cookieOptions, maxAge: 60 * 60 * 24 * 7 });
  if (tokens.refreshToken) {
    jar.set(REFRESH_COOKIE, tokens.refreshToken, { ...cookieOptions, maxAge: 60 * 60 * 24 * 30 });
  }
  // Readable by middleware, which runs on the Edge and cannot verify a token.
  jar.set(ROLE_COOKIE, role, { ...cookieOptions, httpOnly: false, maxAge: 60 * 60 * 24 * 7 });
}

export async function clearSession() {
  const jar = await cookies();
  jar.set(TOKEN_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  jar.set(REFRESH_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  jar.set(ROLE_COOKIE, "", { ...cookieOptions, httpOnly: false, maxAge: 0 });
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(TOKEN_COOKIE)?.value;
  const role = jar.get(ROLE_COOKIE)?.value;
  if (!token || (role !== "CUSTOMER" && role !== "PROVIDER" && role !== "ADMIN")) return null;
  return { role, token };
}

/** Server-side only: the access token for outgoing API calls. */
export async function getAccessToken() {
  const jar = await cookies();
  return jar.get(TOKEN_COOKIE)?.value ?? null;
}

export type ApiUser = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  profile_image?: string | null;
  is_active?: boolean;
  is_verified?: boolean;
  fullName?: string;
};

/**
 * The signed-in user as the API describes them, with the profile records the
 * screens expect. Customers are users, so their "profile" is the user id.
 */
export type SessionUser = ApiUser & {
  customerProfile: { id: string } | null;
  providerProfile: Record<string, unknown> | null;
};

export async function getApiUser(token: string): Promise<ApiUser> {
  const res = await apiFetch<{ user: ApiUser }>("/auth/me", { token });
  return res.user;
}

/** The provider profile for the signed-in provider, or null if there isn't one. */
export async function getMyProvider(token: string) {
  try {
    const res = await apiFetch<{ provider: Record<string, unknown> }>("/providers/me", { token });
    return res.provider;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function requireUser(role?: Role): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new HttpError("Please log in to continue.", 401);
  if (role && session.role !== role) throw new HttpError("You do not have access to this.", 403);

  const user = await getApiUser(session.token);
  if (!user || user.is_active === false) throw new HttpError("Please log in to continue.", 401);
  // The role cookie is readable by the Edge middleware, so it cannot be
  // trusted on its own: the API's own answer decides what this caller may do.
  if (role && toUiRole(user.role) !== role) throw new HttpError("You do not have access to this.", 403);

  const providerProfile = user.role === "provider" ? await getMyProvider(session.token) : null;

  return {
    ...user,
    fullName: user.fullName ?? user.name,
    customerProfile: { id: user.id },
    providerProfile,
  };
}

/**
 * The caller's own profile id in whichever role they hold. Screens pass this
 * around as the booking's customer or provider reference.
 */
export async function requireProfileId(role?: Role) {
  const user = await requireUser(role);
  if (role === "PROVIDER") {
    const id = (user.providerProfile as { id?: string } | null)?.id;
    if (!id) throw new HttpError("Finish your provider profile to continue.", 403);
    return { user, profileId: id };
  }
  return { user, profileId: user.id };
}