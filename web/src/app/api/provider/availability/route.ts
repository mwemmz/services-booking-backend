import { z } from "zod";
import { route, ok, readJson, HttpError } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await requireUser("PROVIDER");
  const provider = user.providerProfile as { id: string; verificationStatus?: string } | null;
  if (!provider?.id) throw new HttpError("You do not have access to this.", 403);
  const token = await getAccessToken();
  const res = await apiFetch("/providers/me/availability", { token });
  return ok(res);
});

export const POST = route(async (req) => {
  const user = await requireUser("PROVIDER");
  const provider = user.providerProfile as { id: string; verificationStatus?: string } | null;
  if (!provider?.id) throw new HttpError("You do not have access to this.", 403);
  const body = z.object({ acceptingJobs: z.boolean() }).parse(await readJson(req));
  const token = await getAccessToken();
  const res = await apiFetch("/providers/me/availability", { method: "PUT", token, body: {} });
  return ok(res);
});

export const PUT = route(async (req) => {
  const user = await requireUser("PROVIDER");
  const provider = user.providerProfile as { id: string; verificationStatus?: string } | null;
  if (!provider?.id) throw new HttpError("You do not have access to this.", 403);
  const body = z
    .object({
      days: z.array(
        z.object({
          dayOfWeek: z.number().int(),
          startTime: z.string(),
          endTime: z.string(),
          isActive: z.boolean(),
        }),
      ),
    })
    .parse(await readJson(req));
  const token = await getAccessToken();
  const res = await apiFetch("/providers/me/availability", { method: "PUT", token, body });
  return ok(res);
});
