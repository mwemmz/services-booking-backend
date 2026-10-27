import { z } from "zod";
import { route, ok, readJson, HttpError } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import { loadBooking, loadBookingList, toBookingTime, viewerOf } from "@/lib/booking-bff";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await requireUser();
  const token = await getAccessToken();
  return ok(await loadBookingList(token, viewerOf(user.role)));
});

export const POST = route(async (req) => {
  const user = await requireUser("CUSTOMER");
  const body = z
    .object({
      providerId: z.string(),
      serviceId: z.string(),
      date: z.string(),
      time: z.string(),
      addressLine: z.string().min(3, "Add the location for this booking."),
      latitude: z.number().optional().nullable(),
      longitude: z.number().optional().nullable(),
      notes: z.string().max(500).optional(),
      paymentMethod: z.string().min(2, "Choose a payment method.").max(80),
      saveAddress: z.boolean().optional(),
      addressLabel: z.string().max(40).optional(),
    })
    .parse(await readJson(req));
  if (!user.customerProfile) throw new HttpError("You do not have access to this.", 403);
  const token = await getAccessToken();
  const created = await apiFetch<{ booking: { id: string } }>("/bookings", {
    method: "POST",
    token,
    body: {
      provider_id: body.providerId,
      service_id: body.serviceId,
      booking_time: toBookingTime(body.date, body.time),
      address: body.addressLine,
      location_lat: body.latitude ?? undefined,
      location_lng: body.longitude ?? undefined,
      notes: body.notes ? `${body.notes}` : undefined,
    },
  });
  return ok(await loadBooking(created.booking.id, token, "CUSTOMER"), 201);
});
