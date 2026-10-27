import { z } from "zod";
import { route, ok, readJson, HttpError } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import { loadOfferings } from "@/lib/provider-services";

export const dynamic = "force-dynamic";

async function provider() {
  const user = await requireUser("PROVIDER");
  if (!user.providerProfile) throw new HttpError("You do not have access to this.", 403);
  return String(user.providerProfile.id);
}

export const GET = route(async () => {
  const id = await provider();
  return ok(await loadOfferings(id, await getAccessToken()));
});

export const POST = route(async (req) => {
  const id = await provider();
  const token = await getAccessToken();
  const body = z
    .object({
      categoryId: z.string().optional(),
      serviceId: z.string().optional(),
      newServiceName: z.string().trim().min(2).optional(),
      price: z.number().positive("Enter a price above zero."),
      description: z.string().optional(),
      durationMinutes: z.number().int().positive().default(60),
      imageUrl: z.string().nullable().optional(),
    })
    .parse(await readJson(req));

  const cats = await apiFetch<{ categories: { id: string; name: string; services: { id: string; name: string }[] }[] }>("/catalog/categories");
  const category = cats.categories.find((c) => c.id === body.categoryId);
  const catalog = category?.services.find((s) => s.id === body.serviceId);
  const name = body.newServiceName ?? catalog?.name;
  if (!name) throw new HttpError("Choose a service or add a new one.", 400);

  await apiFetch("/services", {
    method: "POST",
    token,
    body: {
      name,
      price: body.price,
      description: body.description || undefined,
      duration: body.durationMinutes,
      category: category?.name ?? "General",
      image: body.imageUrl ?? undefined,
      catalog_service_id: catalog?.id,
    },
  });
  return ok(await loadOfferings(id, token), 201);
});
