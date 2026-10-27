import { route, ok, HttpError } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import { loadBookingList } from "@/lib/booking-bff";

export const dynamic = "force-dynamic";

type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const GET = route(async () => {
  const user = await requireUser("PROVIDER");
  if (!user.providerProfile) throw new HttpError("You do not have access to this.", 403);
  const token = await getAccessToken();
  const [res, bookings] = await Promise.all([
    apiFetch<{ reviews: Raw[]; averageRating: number }>(`/reviews/provider/${user.providerProfile.id}?limit=100`, { token }),
    loadBookingList(token, "PROVIDER").catch(() => []),
  ]);
  const serviceByBooking = new Map(bookings.map((b) => [b.id, b.service.name]));
  const reviews = res.reviews ?? [];
  return ok({
    rating: Number(res.averageRating ?? 0),
    reviewCount: reviews.length,
    buckets: [5, 4, 3, 2, 1].map((stars) => ({ stars, count: reviews.filter((r) => r.rating === stars).length })),
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment ?? "",
      authorName: r.customer?.name ?? "Customer",
      service: serviceByBooking.get(r.booking_id) ?? "",
      createdAt: r.createdAt,
    })),
  });
});
