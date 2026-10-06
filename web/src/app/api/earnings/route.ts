import { route, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireUser();
  const token = await getAccessToken();
  const res = await apiFetch("/providers/earnings", { token });
  return ok(res);
});
