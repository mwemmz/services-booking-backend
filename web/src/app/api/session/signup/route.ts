import { z } from "zod";
import { route, ok, readJson, HttpError } from "@/lib/http";
import { registerQuick } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

const schema = z.object({
  role: z.enum(["CUSTOMER", "PROVIDER"]),
  fullName: z.string().trim().min(2, "Enter your full name.").max(80),
  phone: z.string().min(1, "Enter your phone number."),
  password: z.string().min(6, "Use at least 6 characters."),
  email: z.string().trim().email("Please enter a valid email address.").optional().or(z.literal("")),
});

export const POST = route(async (req) => {
  const body = schema.parse(await readJson(req));
  const phone = normalizePhone(body.phone);
  if (!phone) throw new HttpError("Enter a valid Zambian phone number.", 400);
  const { role } = await registerQuick({
    role: body.role,
    name: body.fullName,
    phone,
    password: body.password,
    email: body.email || undefined,
  });
  return ok({ ok: true, role, home: role === "PROVIDER" ? "/provider/home" : "/customer/home" }, 201);
});
