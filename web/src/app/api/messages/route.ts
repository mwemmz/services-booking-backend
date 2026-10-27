import { z } from "zod";
import { route, ok, readJson } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import { loadBooking, loadBookingList, viewerOf } from "@/lib/booking-bff";

export const dynamic = "force-dynamic";

type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const toMessage = (raw: Raw, me: string) => ({
  id: raw.id,
  senderId: raw.sender_id,
  body: raw.text,
  createdAt: raw.createdAt,
  readAt: raw.is_read ? raw.updatedAt ?? raw.createdAt : null,
  mine: raw.sender_id === me,
});

async function conversationFor(bookingId: string, token: string | null) {
  const res = await apiFetch<{ conversation: { id: string } }>(`/messages/conversations/booking/${bookingId}`, { token });
  return res.conversation.id;
}

export const GET = route(async (req) => {
  const user = await requireUser();
  const token = await getAccessToken();
  const bookingId = new URL(req.url).searchParams.get("bookingId");

  if (bookingId) {
    const [conversationId, booking] = await Promise.all([conversationFor(bookingId, token), loadBooking(bookingId, token, viewerOf(user.role))]);
    const res = await apiFetch<{ messages: Raw[] }>(`/messages/conversations/${conversationId}/messages`, { token });
    return ok({
      booking: { providerName: booking.provider.name, customerName: booking.customer?.name ?? "Customer", service: booking.service.name },
      messages: (res.messages ?? []).map((m) => toMessage(m, user.id)),
    });
  }

  const [res, bookings] = await Promise.all([
    apiFetch<{ conversations: Raw[] }>("/messages/conversations", { token }),
    loadBookingList(token, viewerOf(user.role)).catch(() => []),
  ]);
  const byId = new Map(bookings.map((b) => [b.id, b]));
  return ok(
    (res.conversations ?? []).map((c) => {
      const booking = byId.get(c.booking_id);
      const customerSide = viewerOf(user.role) === "CUSTOMER";
      const other = customerSide ? c.provider?.business_name ?? c.provider?.user?.name : c.customer?.name;
      const avatar = customerSide ? c.provider?.user?.profile_image : c.customer?.profile_image;
      return {
        bookingId: c.booking_id,
        name: other ?? "Conversation",
        avatarUrl: avatar ?? null,
        service: booking?.service.name ?? "Booking",
        status: booking?.status ?? "",
        lastMessage: c.last_message ?? "No messages yet",
        lastAt: c.last_message_at ?? "",
        unread: Number(c.unread_count ?? 0),
      };
    }),
  );
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const token = await getAccessToken();
  const body = z.object({ bookingId: z.string(), body: z.string().min(1) }).parse(await readJson(req));
  const conversationId = await conversationFor(body.bookingId, token);
  const res = await apiFetch<{ message: Raw }>(`/messages/conversations/${conversationId}/messages`, { method: "POST", token, body: { text: body.body } });
  return ok(toMessage(res.message, user.id), 201);
});
