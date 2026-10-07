import { route, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

export const dynamic = "force-dynamic";

type ApiNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: { bookingId?: string; status?: string } | null;
  read: boolean;
  createdAt: string;
};

type WebNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export const GET = route(async () => {
  const user = await requireUser();
  const token = await getAccessToken();
  const res = (await apiFetch<unknown>("/notifications", { token })) as { notifications?: ApiNotification[] } | undefined;
  const rows = Array.isArray(res?.notifications) ? res.notifications : [];
  const isProvider = user.role === "provider";
  return ok(
    rows.map((item) => {
      const type =
        item.type === "new_request" ? "NEW_BOOKING" : item.type === "booking_update" ? "BOOKING_UPDATE" : item.type.toUpperCase();
      const bookingId = item.data?.bookingId;
      const href = bookingId
        ? type === "NEW_BOOKING" || isProvider
          ? `/provider/bookings/${bookingId}`
          : `/customer/bookings/${bookingId}`
        : null;
      return {
        id: item.id,
        type,
        title: item.title,
        body: item.body,
        href,
        readAt: item.read ? item.createdAt : null,
        createdAt: item.createdAt,
      } satisfies WebNotification;
    }),
  );
});
