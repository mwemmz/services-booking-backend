import { z } from "zod";
import { route, ok, readJson, HttpError } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import { loadBooking, toApiStatus, viewerOf } from "@/lib/booking-bff";

export const dynamic = "force-dynamic";

const denied = () => new HttpError("You do not have access to this.", 403);

export const POST = route(async (req, ctx) => {
  const user = await requireUser();
  const { id, action } = await ctx.params;
  const token = await getAccessToken();
  const viewer = viewerOf(user.role);

  if (action === "accept") {
    if (viewer !== "PROVIDER") throw denied();
    const body = z.object({ price: z.number().int().positive().optional() }).parse(await readJson(req));
    await apiFetch(`/bookings/${id}/status`, {
      method: "PUT",
      token,
      body: body.price ? { status: "accepted", quoted_price: body.price } : { status: "accepted" },
    });
  } else if (action === "confirm") {
    if (viewer !== "CUSTOMER") throw denied();
    await apiFetch(`/bookings/${id}/confirm-quote`, { method: "PUT", token });
  } else if (action === "reject") {
    if (viewer !== "PROVIDER") throw denied();
    const body = z.object({ reason: z.string().max(300).optional() }).parse(await readJson(req));
    await apiFetch(`/bookings/${id}/reject`, { method: "PUT", body, token });
  } else if (action === "cancel") {
    const body = z.object({ reason: z.string().max(300).optional() }).parse(await readJson(req));
    await apiFetch(`/bookings/${id}/cancel`, { method: "PUT", body, token });
  } else if (action === "status") {
    if (viewer !== "PROVIDER") throw denied();
    const body = z.object({ status: z.string() }).parse(await readJson(req));
    await apiFetch(`/bookings/${id}/status`, { method: "PUT", body: { status: toApiStatus(body.status) }, token });
  } else if (action === "location") {
    if (viewer !== "PROVIDER") throw denied();
    const body = z
      .object({
        latitude: z.number(),
        longitude: z.number(),
        accuracy: z.number().optional(),
        heading: z.number().nullable().optional(),
      })
      .parse(await readJson(req));
    await apiFetch(`/bookings/${id}/location`, { method: "PUT", body, token });
  } else if (action === "route-feedback") {
    if (viewer !== "CUSTOMER") throw denied();
    const body = z.object({ message: z.string().max(140).optional() }).parse(await readJson(req));
    await apiFetch(`/bookings/${id}/route-feedback`, { method: "PUT", body, token });
  } else {
    throw new HttpError("That action is not available.", 404);
  }

  return ok(await loadBooking(id, token, viewer));
});
