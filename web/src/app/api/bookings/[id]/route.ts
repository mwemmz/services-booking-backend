import { route, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { getAccessToken } from "@/lib/session";
import { loadBooking, viewerOf } from "@/lib/booking-bff";

export const dynamic = "force-dynamic";

export const GET = route(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const token = await getAccessToken();
  return ok(await loadBooking(id, token, viewerOf(user.role)));
});
