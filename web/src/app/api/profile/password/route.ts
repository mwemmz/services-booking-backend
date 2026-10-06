import { z } from "zod";
import { route, ok, readJson } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  await requireUser();
  const body = z
    .object({
      currentPassword: z.string().min(1, "Enter your current password."),
      newPassword: z.string().min(6, "Use at least 6 characters."),
    })
    .parse(await readJson(req));
  const token = await getAccessToken();
  await apiFetch("/auth/change-password", { method: "POST", token, body });
  return ok({ message: "Password updated." });
});
