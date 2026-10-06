import { route, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export const POST = route(async () => {
  await requireUser();
  const token = await getAccessToken();
  await apiFetch("/notifications/read", { method: "PUT", token, body: {} });
  return ok({ ok: true });
});
