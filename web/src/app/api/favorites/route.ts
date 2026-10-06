import { z } from "zod";
import { route, ok, readJson, HttpError } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { apiFetch, ApiError } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await requireUser("CUSTOMER");
  if (!user.customerProfile) throw new HttpError("You do not have access to this.", 403);
  const token = await getAccessToken();
  const res = (await apiFetch<unknown>("/favourites", { token })) as { favourites?: unknown[] } | undefined;
  return ok(res?.favourites ?? res ?? []);
});

export const POST = route(async (req) => {
  const user = await requireUser("CUSTOMER");
  if (!user.customerProfile) throw new HttpError("You do not have access to this.", 403);
  const body = z.object({ providerId: z.string() }).parse(await readJson(req));
  const token = await getAccessToken();
  try {
    const res = await apiFetch("/favourites", { method: "POST", body: { provider_id: body.providerId }, token });
    return ok(res);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) throw new HttpError("Provider not found.", 404);
    throw e;
  }
});
