import { z } from "zod";
import { route, ok, readJson, HttpError } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import { loadOfferings } from "@/lib/provider-services";

export const dynamic = "force-dynamic";

async function provider() {
  const user = await requireUser("PROVIDER");
  if (!user.providerProfile) throw new HttpError("You do not have access to this.", 403);
  return String(user.providerProfile.id);
}

export const PATCH = route(async (req, ctx) => {
  const providerId = await provider();
  const { id } = await ctx.params;
  const token = await getAccessToken();
  const body = z
    .object({
      price: z.number().positive().optional(),
      description: z.string().optional(),
      durationMinutes: z.number().int().positive().optional(),
      isActive: z.boolean().optional(),
      imageUrl: z.string().nullable().optional(),
    })
    .parse(await readJson(req));
  await apiFetch(`/services/${id}`, {
    method: "PUT",
    token,
    body: {
      price: body.price,
      description: body.description,
      duration: body.durationMinutes,
      is_active: body.isActive,
      image: body.imageUrl ?? undefined,
    },
  });
  return ok(await loadOfferings(providerId, token));
});

export const DELETE = route(async (_req, ctx) => {
  await provider();
  const { id } = await ctx.params;
  await apiFetch(`/services/${id}`, { method: "DELETE", token: await getAccessToken() });
  return ok({ message: "The service has been removed." });
});
