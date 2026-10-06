import { z } from "zod";
import { route, ok, readJson, HttpError } from "@/lib/http";
import { apiFetch } from "@/lib/api";

export const dynamic = "force-dynamic";

const schema = z.object({
  identifier: z.string().trim().optional(),
  phone: z.string().trim().optional(),
});

export const POST = route(async (req) => {
  const body = schema.parse(await readJson(req));
  const identifier = body.identifier ?? body.phone;
  if (!identifier) throw new HttpError("Enter your email or phone number.", 400);

  // The API always answers the same way, whether or not the account exists, so
  // nothing here reveals which numbers are registered.
  const res = await apiFetch<{ message: string; resetCode?: string }>("/auth/forgot-password", {
    method: "POST",
    body: { identifier },
  });

  return ok({ message: res.message, devCode: res.resetCode });
});