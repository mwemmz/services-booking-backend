import { route, ok } from "@/lib/http";
import { clearSession, requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export const POST = route(async () => {
  const user = await requireUser();
  const token = await getAccessToken();
  try {
    await apiFetch("/auth/deactivate", { method: "POST", token, body: {} });
  } catch {}
  await clearSession();
  return ok({ message: "Your account has been deactivated." });
});
