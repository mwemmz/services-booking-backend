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
  const res = await apiFetch<{ addresses: { id: string; label: string; address_line: string; latitude: number | null; longitude: number | null }[] }>("/addresses", { token });
  return ok((res.addresses ?? []).map((a) => ({ id: a.id, label: a.label, addressLine: a.address_line, latitude: a.latitude, longitude: a.longitude })));
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
  await apiFetch("/addresses", {
    method: "POST",
    token,
    body: { label: body.label, address_line: body.addressLine, latitude: body.latitude ?? undefined, longitude: body.longitude ?? undefined },
  });
  return ok({ ok: true }, 201);
});
