import { z } from "zod";
import { route, ok, readJson, HttpError } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { apiFetch, ApiError } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import { getProvider } from "@/lib/catalog";

export const dynamic = "force-dynamic";

async function customer() {
  const user = await requireUser("CUSTOMER");
  if (!user.customerProfile) throw new HttpError("You do not have access to this.", 403);
}

/** The saved providers, as the same cards the browse screens use. */
export const GET = route(async () => {
  await customer();
  const res = await apiFetch<{ favourites: { provider_id: string }[] }>("/favourites", { token: await getAccessToken() });
  // A saved provider may since have been unlisted, so skip any that can no longer be loaded.
  const cards = await Promise.all((res.favourites ?? []).map((f) => getProvider(f.provider_id).catch(() => null)));
  return ok(cards.filter((card) => card !== null).map((card) => ({ ...card, favorite: true })));
});

/** Tapping the heart saves the provider, or removes them when they were already saved. */
export const POST = route(async (req) => {
  await customer();
  const { providerId } = z.object({ providerId: z.string() }).parse(await readJson(req));
  const token = await getAccessToken();
  try {
    const status = await apiFetch<{ is_favourite?: boolean }>(`/favourites/${providerId}/status`, { token });
    if (status.is_favourite) {
      await apiFetch(`/favourites/${providerId}`, { method: "DELETE", token });
      return ok({ favorite: false });
    }
    await apiFetch("/favourites", { method: "POST", body: { provider_id: providerId }, token });
    return ok({ favorite: true });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) throw new HttpError("Provider not found.", 404);
    throw e;
  }
});
