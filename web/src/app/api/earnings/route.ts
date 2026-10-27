import { route, ok, HttpError } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { getAccessToken } from "@/lib/session";
import { loadBookingList } from "@/lib/booking-bff";

export const dynamic = "force-dynamic";

const ZONE = "Africa/Lusaka";
const dayKey = (value: string | Date) => new Intl.DateTimeFormat("en-CA", { timeZone: ZONE }).format(new Date(value));

/** Earnings are worked out from the provider's own bookings, so the figures match what they see elsewhere. */
export const GET = route(async () => {
  const user = await requireUser("PROVIDER");
  if (!user.providerProfile) throw new HttpError("You do not have access to this.", 403);
  const bookings = await loadBookingList(await getAccessToken(), "PROVIDER");

  const amount = (b: { price: number; quotedPrice?: number | null }) => Number(b.quotedPrice ?? b.price ?? 0);
  const done = bookings.filter((b) => b.status === "COMPLETED");
  const at = (b: { completedAt?: string | null; createdAt: string }) => new Date(b.completedAt ?? b.createdAt);
  const sum = (rows: typeof done) => rows.reduce((total, b) => total + amount(b), 0);

  const now = Date.now();
  const today = dayKey(new Date());
  const month = today.slice(0, 7);

  return ok({
    total: sum(done),
    today: sum(done.filter((b) => dayKey(at(b)) === today)),
    week: sum(done.filter((b) => now - at(b).getTime() <= 7 * 864e5)),
    month: sum(done.filter((b) => dayKey(at(b)).startsWith(month))),
    pending: sum(bookings.filter((b) => ["ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_PROGRESS"].includes(b.status))),
    completedJobs: done.length,
    cancelledJobs: bookings.filter((b) => ["CANCELLED", "REJECTED"].includes(b.status)).length,
    transactions: done.map((b) => ({
      id: b.id,
      amount: amount(b),
      status: b.status,
      service: b.service.name,
      customer: b.customer?.name ?? "Customer",
      date: dayKey(at(b)),
    })),
  });
});
