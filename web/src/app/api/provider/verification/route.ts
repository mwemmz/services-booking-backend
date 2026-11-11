import { z } from "zod";
import { route, ok, readJson } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  await requireUser("PROVIDER");
  const body = z.object({ nrc: z.string().trim().min(1, "Enter your NRC number.") }).parse(await readJson(req));
  return ok(await apiFetch("/providers/me/verification", { method: "POST", token: await getAccessToken(), body: { national_id_number: body.nrc } }));
});
