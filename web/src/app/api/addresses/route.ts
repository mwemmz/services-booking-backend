import { z } from "zod";
import { route, ok, readJson, HttpError } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await requireUser("CUSTOMER");
  if (!user.customerProfile) throw new HttpError("You do not have access to this.", 403);
  const token = await getAccessToken();
  const res = await apiFetch<{ addresses: unknown[] }>("/addresses", { token });
  return ok(res.addresses ?? []);
});

export const POST = route(async (req) => {
  const user = await requireUser("CUSTOMER");
  if (!user.customerProfile) throw new HttpError("You do not have access to this.", 403);
  const body = z
    .object({
      label: z.string().trim().min(1, "Name this address.").max(40),
      addressLine: z.string().trim().min(3, "Enter the address.").max(160),
      latitude: z.number().optional().nullable(),
      longitude: z.number().optional().nullable(),
    })
    .parse(await readJson(req));
  const token = await getAccessToken();
  const res = await apiFetch("/addresses", { method: "POST", body, token });
  return ok(res, 201);
});
