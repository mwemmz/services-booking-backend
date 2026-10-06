import { z } from "zod";
import { route, ok, readJson, HttpError } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export const GET = route(async (_req, ctx) => {
  const user = await requireUser("PROVIDER");
  if (!user.providerProfile) throw new HttpError("You do not have access to this.", 403);
  const { id } = await ctx.params;
  const token = await getAccessToken();
  const res = await apiFetch(`/services/${id}`, { token });
  return ok(res);
});

export const PUT = route(async (req, ctx) => {
  const user = await requireUser("PROVIDER");
  if (!user.providerProfile) throw new HttpError("You do not have access to this.", 403);
  const { id } = await ctx.params;
  const body = z.object({ name: z.string().min(2), price: z.number().positive(), description: z.string().optional(), categoryId: z.string().optional(), catalog_service_id: z.string().uuid().optional().nullable(), is_active: z.boolean().optional() }).parse(await readJson(req));
  const token = await getAccessToken();
  const res = await apiFetch(`/services/${id}`, { method: "PUT", body, token });
  return ok(res);
});

export const DELETE = route(async (_req, ctx) => {
  const user = await requireUser("PROVIDER");
  if (!user.providerProfile) throw new HttpError("You do not have access to this.", 403);
  const { id } = await ctx.params;
  const token = await getAccessToken();
  await apiFetch(`/services/${id}`, { method: "DELETE", token });
  return ok({ ok: true });
});
