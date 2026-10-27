import { z } from "zod";
import { route, ok, readJson, HttpError } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

export const dynamic = "force-dynamic";

async function providerId() {
  const user = await requireUser("PROVIDER");
  const provider = user.providerProfile as { id: string } | null;
  if (!provider?.id) throw new HttpError("You do not have access to this.", 403);
  return provider.id;
}

type Window = { day_of_week: number; start_time: string; end_time: string; is_active: boolean };

export const GET = route(async () => {
  await providerId();
  const res = await apiFetch<{ availability: Window[] }>("/providers/me/availability", { token: await getAccessToken() });
  return ok(
    (res.availability ?? []).map((w) => ({
      dayOfWeek: w.day_of_week,
      startTime: String(w.start_time).slice(0, 5),
      endTime: String(w.end_time).slice(0, 5),
      isActive: w.is_active,
    })),
  );
});

/** Goes online or offline. The API only flips the flag, so we read it first and flip only when it differs. */
export const POST = route(async (req) => {
  const id = await providerId();
  const { acceptingJobs } = z.object({ acceptingJobs: z.boolean() }).parse(await readJson(req));
  const token = await getAccessToken();
  const me = await apiFetch<{ provider: { is_online: boolean } }>("/providers/me", { token });
  if (Boolean(me.provider.is_online) !== acceptingJobs) {
    await apiFetch(`/providers/${id}/status`, { method: "PUT", token });
  }
  return ok({ acceptingJobs });
});

export const PUT = route(async (req) => {
  await providerId();
  const body = z
    .object({
      days: z.array(z.object({ dayOfWeek: z.number().int(), startTime: z.string(), endTime: z.string(), isActive: z.boolean() })),
    })
    .parse(await readJson(req));
  await apiFetch("/providers/me/availability", {
    method: "PUT",
    token: await getAccessToken(),
    body: {
      availability: body.days.map((d) => ({ day_of_week: d.dayOfWeek, start_time: d.startTime, end_time: d.endTime, is_active: d.isActive })),
    },
  });
  return ok({ ok: true });
});
