import { route, ok, HttpError } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import { loadBookingList } from "@/lib/booking-bff";

export const dynamic = "force-dynamic";

type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const ZONE = "Africa/Lusaka";
const dayKey = (value: string | Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: ZONE }).format(new Date(value));

/** Builds the provider home payload from the Express API's profile, services, bookings and reviews. */
export const GET = route(async () => {
  const user = await requireUser("PROVIDER");
  if (!user.providerProfile) throw new HttpError("You do not have access to this.", 403);
  const token = await getAccessToken();
  const providerId = user.providerProfile.id;

  const [me, svc, bookings, reviewRes] = await Promise.all([
    apiFetch<{ provider: Raw }>("/providers/me", { token }),
    apiFetch<{ services: Raw[] }>(`/services/provider/${providerId}`, { token }),
    loadBookingList(token, "PROVIDER"),
    apiFetch<{ reviews?: Raw[] }>(`/reviews/provider/${providerId}`, { token }).catch(() => ({ reviews: [] as Raw[] })),
  ]);

  const done = bookings.filter((b) => b.status === "COMPLETED");
  const earned = (b: { price: number; quotedPrice?: number | null }) => Number(b.quotedPrice ?? b.price ?? 0);
  const today = dayKey(new Date());
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const doneAt = (b: { completedAt?: string | null; createdAt: string }) => new Date(b.completedAt ?? b.createdAt);

  const todayEarnings = done.filter((b) => dayKey(doneAt(b)) === today).reduce((s, b) => s + earned(b), 0);
  const weekDone = done.filter((b) => doneAt(b).getTime() >= weekAgo);
  const review = (reviewRes.reviews ?? [])[0];

  return ok({
    todayEarnings,
    weekEarnings: weekDone.reduce((s, b) => s + earned(b), 0),
    weekJobs: weekDone.length,
    totalEarnings: done.reduce((s, b) => s + earned(b), 0),
    pendingRequests: bookings.filter((b) => b.status === "PENDING").length,
    activeJobs: bookings.filter((b) => ["ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_PROGRESS"].includes(b.status)).length,
    completedJobs: done.length,
    rating: Number(me.provider.rating ?? 0),
    reviewCount: Number(me.provider.total_reviews ?? 0),
    verificationStatus: me.provider.is_verified ? "VERIFIED" : "PENDING",
    services: (svc.services ?? []).map((s) => ({
      id: s.id,
      serviceId: s.catalog_service_id ?? s.id,
      name: s.name,
      category: s.category ?? "",
      categoryId: "",
      price: Number(s.price),
      description: s.description ?? "",
      durationMinutes: s.duration ?? 60,
      isActive: s.is_active !== false,
      imageUrl: s.image_url ?? null,
      source: "account",
    })),
    latestReview: review
      ? { id: review.id, rating: review.rating, comment: review.comment ?? "", authorName: review.customer?.name ?? "Customer" }
      : null,
    recent: bookings.slice(0, 10),
  });
});
