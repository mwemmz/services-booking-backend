import { route, ok } from "@/lib/http";
import { adminProxy } from "@/lib/admin";

export const dynamic = "force-dynamic";

export const PUT = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  return ok(await adminProxy(`/certifications/${id}/reject`, req, { method: "PUT", body }));
});
