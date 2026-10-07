import { z } from "zod";
import { route, ok, readJson, HttpError } from "@/lib/http";
import { login } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().trim().optional(),
  identifier: z.string().trim().optional(),
  password: z.string().min(1, "Enter your password."),
});

export const POST = route(async (req) => {
  const body = schema.parse(await readJson(req));
  const identifier = body.identifier ?? body.email;
  if (!identifier) throw new HttpError("Enter your email address.", 400);
  await login(identifier, body.password, "ADMIN");
  return ok({ ok: true });
});