/**
 * Auth facade for the screens and route handlers.
 *
 * Everything here delegates to the Express API: passwords are never hashed or
 * stored in this app, and the signed-in user is whatever the API reports.
 */
import { apiFetch } from "@/lib/api";
import { HttpError } from "@/lib/http";
import {
  clearSession,
  getMyProvider,
  getSession,
  requireUser,
  setSession,
  type Role,
  type SessionUser,
} from "@/lib/session";

export { clearSession, getSession, setSession, requireUser };
export type { Role, SessionUser };

export type AuthResult = { user: SessionUser };

export async function login(email: string, password: string, expected?: Role) {
  const res = await apiFetch<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; role: string };
  }>("/auth/login", { method: "POST", body: { email, password } });

  const role = String(res.user.role).toUpperCase() === "PROVIDER" ? "PROVIDER" : "CUSTOMER";
  if (expected && role !== expected) {
    throw new HttpError(
      role === "PROVIDER"
        ? "That account belongs to a provider. Sign in from the provider side."
        : "That account belongs to a customer. Sign in from the customer side.",
      403,
    );
  }

  await setSession({ accessToken: res.accessToken, refreshToken: res.refreshToken }, res.user);
  return { role, userId: res.user.id };
}

export async function registerCustomer(input: { name: string; email: string; phone: string; password: string }) {
  const res = await apiFetch<{ accessToken: string; refreshToken: string; user: { id: string; role: string } }>(
    "/auth/register",
    { method: "POST", body: { ...input, role: "customer" } },
  );
  await setSession({ accessToken: res.accessToken, refreshToken: res.refreshToken }, res.user);
  return { role: "CUSTOMER" as const, userId: res.user.id };
}

export async function registerProvider(
  input: { name: string; email: string; phone: string; password: string; business_name: string; category: string },
) {
  const res = await apiFetch<{ accessToken: string; refreshToken: string; user: { id: string; role: string } }>(
    "/auth/register",
    { method: "POST", body: { ...input, role: "provider" } },
  );
  await setSession({ accessToken: res.accessToken, refreshToken: res.refreshToken }, res.user);
  return { role: "PROVIDER" as const, userId: res.user.id };
}

/** Notifications and messages that are waiting to be read, for the header badge. */
export async function unreadCounts(userId: string, role: string, profileId: string | undefined) {
  void userId;
  const session = await getSession();
  if (!session) return { unreadNotifications: 0, unreadMessages: 0 };

  const [notifications, conversations] = await Promise.all([
    apiFetch<{ notifications?: Array<{ read_at?: string | null; is_read?: boolean }> }>("/notifications", {
      token: session.token,
    }).catch(() => ({ notifications: [] as Array<{ read_at?: string | null; is_read?: boolean }> })),
    profileId
      ? apiFetch<{ conversations?: Array<{ unread_count?: number }> }>("/messages/conversations", {
          token: session.token,
        }).catch(() => ({ conversations: [] as Array<{ unread_count?: number }> }))
      : Promise.resolve({ conversations: [] as Array<{ unread_count?: number }> }),
  ]);

  const unreadNotifications = (notifications.notifications ?? []).filter((n) => !n.read_at && !n.is_read).length;
  const unreadMessages = (conversations.conversations ?? []).reduce(
    (total, c) => total + (c.unread_count ?? c.unreadCount ?? 0),
    0,
  );

  void role;
  return { unreadNotifications, unreadMessages };
}

export { getMyProvider };