import { route, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { getProvider } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export const GET = route(async (req, ctx) => {
  const user = await requireUser("CUSTOMER");
  const rawParams = ctx.params;
  const params = (rawParams instanceof Promise ? await rawParams : rawParams) as Record<string, string | undefined>;
  const id = String(params?.id ?? "");
  const url = new URL(req.url);
  const lat = url.searchParams.get("lat") ? Number(url.searchParams.get("lat")) : NaN;
  const lng = url.searchParams.get("lng") ? Number(url.searchParams.get("lng")) : NaN;
  return ok(
    await getProvider(id, {
      lat: Number.isFinite(lat) ? lat : undefined,
      lng: Number.isFinite(lng) ? lng : undefined,
    }),
  );
});
