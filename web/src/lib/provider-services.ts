import { apiFetch } from "./api";

type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

type CatalogCategory = { id: string; name: string; slug: string; services: { id: string }[] };

/** Translates the API's snake_case service rows into the Offering the provider screens use. */
export async function loadOfferings(providerId: string, token: string | null) {
  const [svc, cats] = await Promise.all([
    apiFetch<{ services: Raw[] }>("/services/mine", { token }),
    apiFetch<{ categories: CatalogCategory[] }>("/catalog/categories").catch(() => ({ categories: [] as CatalogCategory[] })),
  ]);
  const byCatalog = new Map<string, CatalogCategory>();
  for (const category of cats.categories) for (const service of category.services) byCatalog.set(service.id, category);
  const byName = new Map(cats.categories.map((category) => [category.name.toLowerCase(), category]));

  return (svc.services ?? []).map((s) => {
    const category = (s.catalog_service_id && byCatalog.get(s.catalog_service_id)) || byName.get(String(s.category ?? "").toLowerCase());
    return {
      id: s.id,
      serviceId: s.catalog_service_id ?? s.id,
      name: s.name,
      category: category?.name ?? s.category ?? "",
      categorySlug: category?.slug ?? "",
      categoryId: category?.id ?? "",
      price: Number(s.price),
      description: s.description ?? "",
      durationMinutes: s.duration ?? 60,
      isActive: s.is_active !== false,
      imageUrl: s.image ?? null,
      source: "account" as const,
    };
  });
}
