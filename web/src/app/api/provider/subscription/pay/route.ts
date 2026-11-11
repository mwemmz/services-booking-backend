import { z } from "zod";
import { route, ok, readJson } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  await requireUser("PROVIDER");
  const body = z.object({ method: z.string().max(40).optional() }).parse(await readJson(req));
  return ok(await apiFetch("/providers/me/subscription/pay", { method: "POST", token: await getAccessToken(), body }));
});
