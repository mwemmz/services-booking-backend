/**
 * Server-side client for the Express booking API.
 *
 * The browser never talks to the API directly: route handlers and server
 * components call through here using the access token stored in an httpOnly
 * cookie. That keeps the API origin and token out of reach of client JS.
 */

const API_BASE = (process.env.API_BASE_URL || "http://localhost:5000/api").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export type RequestOptions = {
  token?: string | null;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  formData?: FormData;
};

/**
 * The API reports validation problems as { errors: [{ field, message }] } and
 * everything else as { message }. Prefer the most specific message available.
 */
const messageFrom = (payload: unknown, fallback: string): string => {
  if (payload && typeof payload === "object") {
    const record = payload as { message?: unknown; error?: unknown; errors?: unknown };
    if (Array.isArray(record.errors) && record.errors.length > 0) {
      const first = record.errors[0] as { message?: unknown };
      if (typeof first?.message === "string" && first.message) return first.message;
    }
    if (typeof record.message === "string" && record.message) return record.message;
    if (typeof record.error === "string" && record.error) return record.error;
  }
  return fallback;
};

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, method = "GET", body, formData } = options;

  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (body !== undefined) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ApiError("Unable to reach the service. Please try again.", 0);
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(messageFrom(payload, "Something went wrong. Please try again."), response.status);
  }

  return payload as T;
}

/** Convenience wrappers for the verb-heavy booking and profile routes. */
export const apiPost = <T>(path: string, body: unknown, token?: string | null) =>
  apiFetch<T>(path, { method: "POST", body, token });

export const apiPut = <T>(path: string, body: unknown, token?: string | null) =>
  apiFetch<T>(path, { method: "PUT", body, token });

export const apiPatch = <T>(path: string, body: unknown, token?: string | null) =>
  apiFetch<T>(path, { method: "PATCH", body, token });

export const apiDelete = <T>(path: string, token?: string | null) =>
  apiFetch<T>(path, { method: "DELETE", token });

/** Map our API's lowercase roles onto the roles the UI is built around. */
export type UiRole = "CUSTOMER" | "PROVIDER" | "ADMIN";

export const toUiRole = (role: string | undefined | null): UiRole =>
  role === "provider" ? "PROVIDER" : role === "admin" ? "ADMIN" : "CUSTOMER";

export const toApiRole = (role: UiRole): "customer" | "provider" =>
  role === "PROVIDER" ? "provider" : "customer";