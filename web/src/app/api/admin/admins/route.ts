import { route, ok } from "@/lib/http";
import { adminProxy } from "@/lib/admin";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  const body = await req.json().catch(() => ({}));
  return ok(await adminProxy("/admin/admins", req, { method: "POST", body }));
});
