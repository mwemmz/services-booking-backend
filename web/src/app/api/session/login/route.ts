import { z } from "zod";
import { route, ok, readJson, HttpError } from "@/lib/http";
import { login } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

const schema = z.object({
  identifier: z.string().trim().min(1, "Enter your phone number or email."),
  password: z.string().min(1, "Enter your password."),
});

const HOME = { CUSTOMER: "/customer/home", PROVIDER: "/provider/home", ADMIN: "/admin/dashboard" } as const;

/**
 * The one sign-in for everybody. The account's own role, stored when it was
 * created, decides which side of the app opens, so people never pick a role to
 * log in.
 */
export const POST = route(async (req) => {
  const body = schema.parse(await readJson(req));
  let identifier = body.identifier;
  if (identifier.includes("@")) {
    identifier = identifier.toLowerCase();
  } else {
    const phone = normalizePhone(identifier);
    if (!phone) throw new HttpError("Enter a valid Zambian phone number or an email address.", 400);
    identifier = phone;
  }
  const { role } = await login(identifier, body.password);
  return ok({ ok: true, role, home: HOME[role] });
});
