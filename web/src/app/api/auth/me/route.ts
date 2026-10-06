import { route, ok } from "@/lib/http";
import { requireUser, me } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireUser();
  return ok(await me());
});