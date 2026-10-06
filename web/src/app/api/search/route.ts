import { route, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { searchAll } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const user = await requireUser("CUSTOMER");
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const q = url.searchParams.get("q") ?? "";
  return ok(
    await searchAll(q, {
      lat: Number.isFinite(lat) ? lat : undefined,
      lng: Number.isFinite(lng) ? lng : undefined,
    }),
  );
});