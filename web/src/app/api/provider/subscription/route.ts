import { route, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireUser("PROVIDER");
  return ok(await apiFetch("/providers/me/subscription", { token: await getAccessToken() }));
});
