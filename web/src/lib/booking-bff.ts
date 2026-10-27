import { apiFetch } from "./api";
import { toBooking } from "./serializers";

/**
 * The Express API speaks snake_case with lowercase hyphenated statuses
 * ("on-the-way"); the web screens expect the camelCase shape in types.ts with
 * UPPER_SNAKE statuses. These helpers translate in the BFF so components never
 * see the raw API payload.
 */

export type Viewer = "CUSTOMER" | "PROVIDER";

type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const ZONE = "Africa/Lusaka";

export const toWebStatus = (status: string) => {
  const upper = String(status || "").toUpperCase().replace(/-/g, "_");
  return upper === "PAID" ? "COMPLETED" : upper;
};

export const toApiStatus = (status: string) => String(status || "").toLowerCase().replace(/_/g, "-");

const num = (value: unknown) => (value === null || value === undefined || value === "" ? null : Number(value));

function lusakaParts(iso: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

/** Zambia is UTC+2 all year, so a local date and time map to a fixed-offset ISO string. */
export const toBookingTime = (date: string, time: string) => new Date(`${date}T${time}:00+02:00`).toISOString();

export function fromRawBooking(raw: Raw, viewer: Viewer) {
  const when = lusakaParts(raw.booking_time);
  const history: Raw[] = Array.isArray(raw.statusHistory) ? raw.statusHistory : [];
  const finished = history.find((entry) => ["completed", "paid"].includes(entry.status));
  const cancelled = history.find((entry) => entry.status === "cancelled" || entry.status === "rejected");
  const provider: Raw = raw.provider ?? {};
  const providerUser: Raw = provider.user ?? {};
  const customer: Raw = raw.customer ?? {};
  const service: Raw = raw.service ?? {};
  const live = ["accepted", "on-the-way", "arrived", "in-progress"].includes(raw.status);

  return toBooking(
    {
      id: raw.id,
      status: toWebStatus(raw.status),
      scheduledDate: when.date,
      scheduledTime: when.time,
      addressLine: raw.address ?? "",
      latitude: num(raw.location_lat),
      longitude: num(raw.location_lng),
      notes: raw.notes ?? "",
      paymentMethod: raw.payment?.payment_method ?? null,
      price: Number(raw.total_amount ?? 0),
      quotedPrice: num(raw.quoted_price),
      cancelledBy: null,
      cancellationReason: cancelled?.note ?? null,
      cancelledAt: cancelled?.createdAt ?? null,
      providerLat: live ? num(provider.location_lat) : null,
      providerLng: live ? num(provider.location_lng) : null,
      providerLocationAt: live ? provider.last_location_update ?? null : null,
      completedAt: finished?.createdAt ?? null,
      createdAt: raw.createdAt,
      durationMinutes: service.duration ?? 60,
      service: {
        id: service.id ?? raw.service_id,
        name: service.name ?? "Service",
        slug: "",
        category: service.category ?? "",
        categorySlug: "",
      },
      provider: {
        id: provider.id ?? raw.provider_id,
        name: provider.business_name ?? providerUser.name ?? "Provider",
        personName: providerUser.name ?? provider.business_name ?? "Provider",
        avatarUrl: providerUser.profile_image ?? null,
        verified: Boolean(provider.is_verified),
        rating: Number(provider.rating ?? 0),
        phone: providerUser.phone ?? null,
        latitude: num(provider.location_lat),
        longitude: num(provider.location_lng),
      },
      customer: {
        id: customer.id ?? raw.customer_id,
        name: customer.name ?? "Customer",
        avatarUrl: customer.profile_image ?? null,
        phone: customer.phone ?? null,
      },
      review: raw.review
        ? {
            id: raw.review.id,
            rating: raw.review.rating,
            reason: null,
            comment: raw.review.comment ?? "",
            createdAt: raw.review.createdAt,
          }
        : null,
      history: history.map((entry) => ({
        status: toWebStatus(entry.status),
        note: entry.note ?? null,
        createdAt: entry.createdAt,
      })),
    },
    viewer,
  );
}

export async function loadBooking(id: string, token: string | null, viewer: Viewer) {
  const res = await apiFetch<{ booking: Raw }>(`/bookings/${id}`, { token });
  return fromRawBooking(res.booking, viewer);
}

export async function loadBookingList(token: string | null, viewer: Viewer) {
  const res = await apiFetch<{ bookings: Raw[] }>("/bookings?limit=100", { token });
  return (res.bookings ?? []).map((raw) => fromRawBooking(raw, viewer));
}

export const viewerOf = (role: string): Viewer => (String(role).toUpperCase() === "PROVIDER" ? "PROVIDER" : "CUSTOMER");
