import { z } from "zod";
import { route, ok, readJson, HttpError } from "@/lib/http";
import { login } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  identifier: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  password: z.string().min(1, "Enter your password."),
});

export const POST = route(async (req) => {
  const body = schema.parse(await readJson(req));
  const identifier = body.identifier ?? body.phone;
  if (!identifier) throw new HttpError("Enter your email or phone number.", 400);
  await login(identifier, body.password, "CUSTOMER");
  return ok({ ok: true });
});