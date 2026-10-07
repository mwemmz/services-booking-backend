/**
 * Auth facade for the screens and route handlers.
 *
 * Everything here delegates to the Express API: passwords are never hashed or
 * stored in this app, and the signed-in user is whatever the API reports.
 */
import { apiFetch } from "@/lib/api";
import { HttpError } from "@/lib/http";
import type { Me } from "@/lib/types";
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

export async function login(identifier: string, password: string, expected?: Role) {
  const res = await apiFetch<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; role: string };
  }>("/auth/login", {
    method: "POST",
    // The API takes email or phone in the same field.
    body: { identifier, password },
  });

  const raw = String(res.user.role).toUpperCase();
  const role: Role = raw === "PROVIDER" ? "PROVIDER" : raw === "ADMIN" ? "ADMIN" : "CUSTOMER";
  if (expected && role !== expected) {
    throw new HttpError(
      expected === "ADMIN"
        ? "That account is not an admin account."
        : role === "PROVIDER"
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

export type ProviderOnboarding = {
  name: string;
  email: string;
  phone: string;
  password: string;
  businessName: string;
  bio?: string;
  serviceArea: string;
  baseAddress?: string;
  latitude?: number | null;
  longitude?: number | null;
  idDocumentUrl?: string | null;
  /** Catalogue entries the provider is pricing, with their own price and duration. */
  services: Array<{ catalogServiceId?: string; name: string; price: number; durationMinutes: number }>;
};

/**
 * Provider sign-up is two API calls: create the account, then create the
 * provider profile and its priced services. The account is only usable once both
 * succeed, so a failure in the second step is surfaced rather than swallowed.
 */
export async function registerProvider(input: ProviderOnboarding) {
  const res = await apiFetch<{ accessToken: string; refreshToken: string; user: { id: string; role: string } }>(
    "/auth/register",
    {
      method: "POST",
      body: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        password: input.password,
        role: "provider",
      },
    },
  );

  const tokens = { accessToken: res.accessToken, refreshToken: res.refreshToken };

  try {
    const category = input.services[0]?.name ?? input.businessName;

    await apiFetch("/providers", {
      method: "POST",
      token: tokens.accessToken,
      body: {
        business_name: input.businessName,
        description: input.bio ?? null,
        category,
        service_area: input.serviceArea,
        address: input.baseAddress ?? null,
        location_lat: input.latitude ?? null,
        location_lng: input.longitude ?? null,
        verification_documents: input.idDocumentUrl ? { id_document_url: input.idDocumentUrl } : null,
      },
    });

    for (const service of input.services) {
      await apiFetch("/services", {
        method: "POST",
        token: tokens.accessToken,
        body: {
          name: service.name,
          price: service.price,
          duration: service.durationMinutes,
          category,
          catalog_service_id: service.catalogServiceId ?? null,
        },
      });
    }
  } catch (error) {
    // The account exists but onboarding is incomplete. Surface it so the person
    // can finish setting up rather than being left with a broken account.
    throw new HttpError(
      "Your account was created, but we could not finish setting up your services. Try signing in again.",
      500,
    );
  }

  await setSession(tokens, res.user);
  return { role: "PROVIDER" as const, userId: res.user.id };
}

/** Notifications and messages that are waiting to be read, for the header badge. */
export async function unreadCounts(_userId: string, _role: string, _profileId: string | undefined) {
  const session = await getSession();
  if (!session) return { unreadNotifications: 0, unreadMessages: 0 };

  const empty = { notifications: [] as Array<{ read_at?: string | null }> };
  const noConversations = { conversations: [] as Array<{ unread_count?: number }> };

  const [notifications, conversations] = await Promise.all([
    apiFetch<typeof empty>("/notifications", { token: session.token }).catch(() => empty),
    apiFetch<typeof noConversations>("/messages/conversations", { token: session.token }).catch(
      () => noConversations,
    ),
  ]);

  const unreadNotifications = (notifications.notifications ?? []).filter((n) => !n.read_at).length;
  const unreadMessages = (conversations.conversations ?? []).reduce(
    (total, entry) => total + (entry.unread_count ?? 0),
    0,
  );

  return { unreadNotifications, unreadMessages };
}

export { getMyProvider };

type ApiUser = {
  id: string;
  name: string;
  phone: string | null;
  profile_image: string | null;
  role: string;
};

type ApiProvider = {
  id: string;
  business_name: string | null;
  description: string | null;
  service_area: string | null;
  address: string | null;
  location_lat: string | number | null;
  location_lng: string | number | null;
  rating: string | number | null;
  total_reviews: number | null;
  is_verified: boolean;
  verification_documents: { id_document_url?: string } | null;
  is_online: boolean;
};

const toNumber = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * The signed-in person, as the header and profile screens need it: their account
 * plus, for a provider, the business profile behind it.
 */
export async function me(): Promise<Me> {
  const session = await getSession();
  if (!session) throw new HttpError("Please sign in to continue.", 401);

  const { user } = await apiFetch<{ user: ApiUser }>("/auth/me", { token: session.token });

  const isProvider = String(user.role).toLowerCase() === "provider";
  let provider: Me["provider"] = null;

  if (isProvider) {
    // A provider without a profile row is still a provider; the setup screens
    // need to know that rather than seeing a 404.
    const res = await apiFetch<{ provider: ApiProvider }>("/providers/me", { token: session.token }).catch(
      () => null,
    );

    if (res?.provider) {
      const record = res.provider;
      provider = {
        id: record.id,
        businessName: record.business_name ?? user.name,
        bio: record.description ?? "",
        verificationStatus: record.is_verified ? "VERIFIED" : "PENDING",
        serviceArea: record.service_area ?? "",
        baseAddress: record.address,
        rating: toNumber(record.rating) ?? 0,
        reviewCount: record.total_reviews ?? 0,
        latitude: toNumber(record.location_lat),
        longitude: toNumber(record.location_lng),
        idDocumentUrl: record.verification_documents?.id_document_url ?? null,
        // The API's live toggle is what the UI calls "accepting jobs".
        acceptingJobs: Boolean(record.is_online),
      };
    }
  }

  const counts = await unreadCounts(user.id, user.role, provider?.id);

  return {
    id: user.id,
    role: String(user.role).toLowerCase() === "admin" ? "ADMIN" : isProvider ? "PROVIDER" : "CUSTOMER",
    fullName: user.name,
    phone: user.phone ?? "",
    avatarUrl: user.profile_image,
    customerId: null,
    provider,
    unreadNotifications: counts.unreadNotifications,
    unreadMessages: counts.unreadMessages,
  };
}