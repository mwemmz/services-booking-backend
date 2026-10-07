import { route, ok } from "@/lib/http";
import { adminProxy } from "@/lib/admin";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => ok(await adminProxy("/admin/reports", req)));
