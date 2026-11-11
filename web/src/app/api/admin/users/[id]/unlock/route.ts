import { route, ok } from "@/lib/http";
import { adminProxy } from "@/lib/admin";

export const dynamic = "force-dynamic";

export const PUT = route(async (req, ctx) => {
  const { id } = await ctx.params;
  return ok(await adminProxy(`/admin/users/${id}/unlock`, req, { method: "PUT", body: {} }));
});
