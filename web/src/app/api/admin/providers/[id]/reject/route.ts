import { z } from "zod";
import { route, ok, readJson } from "@/lib/http";
import { adminProxy } from "@/lib/admin";

export const dynamic = "force-dynamic";

export const PUT = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const body = z.object({ reason: z.string().trim().min(5, "Give a short reason so the provider can fix it.").max(300) }).parse(await readJson(req));
  return ok(await adminProxy(`/admin/providers/${id}/reject`, req, { method: "PUT", body }));
});
