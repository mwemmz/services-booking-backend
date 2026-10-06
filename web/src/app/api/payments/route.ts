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
  const res = await apiFetch("/payments/booking/unknown", { token });
  return ok(res);
});

export const POST = route(async () => {
  const user = await requireUser("CUSTOMER");
  if (!user.customerProfile) throw new HttpError("You do not have access to this.", 403);
  const token = await getAccessToken();
  const res = await apiFetch("/payments/initialize", { method: "POST", body: {}, token });
  return ok(res, 201);
});
