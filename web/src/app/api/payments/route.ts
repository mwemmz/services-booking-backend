import { z } from "zod";
import { route, ok, readJson, HttpError } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

export const dynamic = "force-dynamic";

async function guard() {
  const user = await requireUser("CUSTOMER");
  if (!user.customerProfile) throw new HttpError("You do not have access to this.", 403);
}

type Method = { id: string; provider: string; phone: string; label: string };

export const GET = route(async () => {
  await guard();
  const res = await apiFetch<{ methods: Method[] }>("/payment-methods", { token: await getAccessToken() });
  return ok(res.methods ?? []);
});

export const POST = route(async (req) => {
  await guard();
  const body = z.object({ provider: z.enum(["Airtel Money", "MoMo", "Visa"]), phone: z.string().min(4) }).parse(await readJson(req));
  const res = await apiFetch<{ method: Method }>("/payment-methods", { method: "POST", token: await getAccessToken(), body: { network: body.provider, detail: body.phone } });
  return ok(res.method, 201);
});
