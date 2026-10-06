import { z } from "zod";
import { route, ok, readJson } from "@/lib/http";
import { apiFetch } from "@/lib/api";

export const dynamic = "force-dynamic";

const schema = z.object({
  code: z.string().trim().min(4, "Enter the reset code."),
  password: z.string().min(6, "Use at least 6 characters."),
});

export const POST = route(async (req) => {
  const body = schema.parse(await readJson(req));

  const res = await apiFetch<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: { code: body.code, password: body.password },
  });

  return ok({ message: res.message });
});