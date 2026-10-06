import { z } from "zod";
import { route, ok, readJson, HttpError } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export const POST = route(async (req, ctx) => {
  const user = await requireUser();
  const { id, action } = await ctx.params;
  const token = await getAccessToken();
  if (action === "accept") {
    if (user.role !== "PROVIDER") throw new HttpError("You do not have access to this.", 403);
    const body = z.object({ price: z.number().int().positive().optional() }).parse(await readJson(req));
    const res = await apiFetch(`/bookings/${id}/accept`, { method: "PUT", body, token });
    return ok(res);
  }
  if (action === "confirm") {
    if (user.role !== "CUSTOMER") throw new HttpError("You do not have access to this.", 403);
    const res = await apiFetch(`/bookings/${id}/confirm-quote`, { method: "PUT", token });
    return ok(res);
  }
  if (action === "reject") {
    if (user.role !== "PROVIDER") throw new HttpError("You do not have access to this.", 403);
    const body = z.object({ reason: z.string().max(300).optional() }).parse(await readJson(req));
    const res = await apiFetch(`/bookings/${id}/reject`, { method: "PUT", body, token });
    return ok(res);
  }
  if (action === "cancel") {
    const body = z.object({ reason: z.string().max(300).optional() }).parse(await readJson(req));
    const res = await apiFetch(`/bookings/${id}/cancel`, { method: "PUT", body, token });
    return ok(res);
  }
  if (action === "status") {
    if (user.role !== "PROVIDER") throw new HttpError("You do not have access to this.", 403);
    const body = z.object({ status: z.string() }).parse(await readJson(req));
    const res = await apiFetch(`/bookings/${id}/status`, { method: "PUT", body, token });
    return ok(res);
  }
  if (action === "location") {
    if (user.role !== "PROVIDER") throw new HttpError("You do not have access to this.", 403);
    const body = z.object({ latitude: z.number(), longitude: z.number() }).parse(await readJson(req));
    const res = await apiFetch(`/bookings/${id}/location`, { method: "PUT", body, token });
    return ok(res);
  }
  throw new HttpError("That action is not available.", 404);
});
