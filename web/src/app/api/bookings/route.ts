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
  // The booking screen identifies a service by its catalogue id when it has one; the API books the
  // provider's own priced service, so look that up from the provider's list.
  const offered = await apiFetch<{ services: { id: string; catalog_service_id: string | null }[] }>(`/services/provider/${body.providerId}`, { token });
  const service = offered.services.find((item) => item.id === body.serviceId || item.catalog_service_id === body.serviceId);
  if (!service) throw new HttpError("That service is no longer offered by this provider.", 404);
  const created = await apiFetch<{ booking: { id: string } }>("/bookings", {
    method: "POST",
    token,
    body: {
      provider_id: body.providerId,
      service_id: service.id,
      booking_time: toBookingTime(body.date, body.time),
      address: body.addressLine,
      location_lat: body.latitude ?? undefined,
      location_lng: body.longitude ?? undefined,
      notes: body.notes ? `${body.notes}` : undefined,
    },
  });
  if (body.saveAddress) {
    // Saving the address is a convenience; a failure here must not undo the booking.
    await apiFetch("/addresses", {
      method: "POST",
      token,
      body: { label: body.addressLabel || "Saved", address_line: body.addressLine, latitude: body.latitude ?? undefined, longitude: body.longitude ?? undefined },
    }).catch(() => undefined);
  }
  return ok(await loadBooking(created.booking.id, token, "CUSTOMER"), 201);
});
