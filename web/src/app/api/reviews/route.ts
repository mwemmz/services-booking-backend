import { z } from "zod";
import { route, ok, readJson, HttpError } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  const user = await requireUser("CUSTOMER");
  if (!user.customerProfile) throw new HttpError("You do not have access to this.", 403);
  const body = z.object({ bookingId: z.string(), providerId: z.string(), rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional() }).parse(await readJson(req));
  const token = await getAccessToken();
  const res = await apiFetch("/reviews", { method: "POST", body, token });
  return ok(res, 201);
});
