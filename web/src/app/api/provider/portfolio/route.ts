import { route, ok, HttpError } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await requireUser("PROVIDER");
  if (!user.providerProfile) throw new HttpError("You do not have access to this.", 403);
  const token = await getAccessToken();
  const res = await apiFetch(`/portfolio/provider/${user.providerProfile.id}`, { token });
  return ok(res);
});
