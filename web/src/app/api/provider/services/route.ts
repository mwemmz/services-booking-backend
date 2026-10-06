import { z } from "zod";
import { route, ok, readJson, HttpError } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await requireUser("PROVIDER");
  if (!user.providerProfile) throw new HttpError("You do not have access to this.", 403);
  const token = await getAccessToken();
  const res = await apiFetch(`/services/provider/${user.providerProfile.id}`, { token });
  return ok(res);
});

export const POST = route(async (req) => {
  const user = await requireUser("PROVIDER");
  if (!user.providerProfile) throw new HttpError("You do not have access to this.", 403);
  const body = z.object({ name: z.string().min(2), price: z.number().positive(), description: z.string().optional(), categoryId: z.string().optional(), catalog_service_id: z.string().uuid().optional().nullable() }).parse(await readJson(req));
  const token = await getAccessToken();
  const res = await apiFetch("/services", { method: "POST", body, token });
  return ok(res, 201);
});
