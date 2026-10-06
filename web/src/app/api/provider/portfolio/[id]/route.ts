import { route, ok, HttpError } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export const DELETE = route(async (_req, ctx) => {
  const user = await requireUser("PROVIDER");
  if (!user.providerProfile) throw new HttpError("You do not have access to this.", 403);
  const params = await ctx.params;
  const id = params?.id;
  const token = await getAccessToken();
  await apiFetch(`/portfolio/${id}`, { method: "DELETE", token });
  return ok({ ok: true });
});
